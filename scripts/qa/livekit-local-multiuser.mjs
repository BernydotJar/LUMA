/** Real, ephemeral LiveKit OSS + Chromium WebRTC test; NOT LUMA authenticated/prod E2E. */
import { chromium } from '@playwright/test';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const testUrl = process.env.LIVEKIT_TEST_URL;
const testKey = process.env.LIVEKIT_TEST_KEY;
const testSecret = process.env.LIVEKIT_TEST_SECRET;
if (!testUrl?.startsWith('ws://127.0.0.1:') || !testKey || !testSecret) {
  throw new Error('Local-only LiveKit WebRTC test requires LIVEKIT_TEST_URL/KEY/SECRET');
}
const outputFolder = 'evidence/live-classroom-acceptance';
mkdirSync(outputFolder, { recursive: true });
const roomName = 'luma_local_provider_test_' + randomUUID().replaceAll('-', '');
const service = new RoomServiceClient(testUrl.replace(/^ws:/, 'http:'), testKey, testSecret);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const contexts = [];
const events = [];
let conclusion = 'FAIL';
async function createToken(identity) {
  const token = new AccessToken(testKey, testSecret, { identity, name: identity, ttl: '5m' });
  token.addGrant({ room: roomName, roomJoin: true, roomCreate: false,
    canPublish: true, canPublishData: true, canSubscribe: true });
  return token.toJwt();
}
async function join(identity) {
  const ctx = await browser.newContext({ permissions: ['microphone','camera'] });
  contexts.push(ctx);
  const page = await ctx.newPage();
  // localhost is a secure context even over HTTP, and fake inputs avoid user devices.
  await page.goto(testUrl.replace(/^ws:/, 'http:'), { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: resolve('node_modules/livekit-client/dist/livekit-client.umd.js') });
  const token = await createToken(identity);
  const state = await page.evaluate(async ({ url, jwt }) => {
    const room = new LivekitClient.Room({ autoSubscribe: true, adaptiveStream: true });
    window.__room = room;
    window.__disconnectReason = null;
    room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
      window.__disconnectReason = String(reason);
    });
    await room.connect(url, jwt, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    return { connectionState: room.state, publishedTracks: room.localParticipant.audioTrackPublications.size };
  }, { url: testUrl, jwt: token });
  if (state.connectionState !== 'connected' || state.publishedTracks < 1) {
    throw new Error(identity + ': actual audio-track publishing failed: ' + JSON.stringify(state));
  }
  events.push({ role: identity, state, connected: true });
  return { page, token };
}
try {
  await service.createRoom({ name: roomName, maxParticipants: 5, emptyTimeout: 60 });
  const instructor = await join('instructor');
  const learnerA = await join('learner-a');
  const learnerB = await join('learner-b');
  const membersBefore = await service.listParticipants(roomName);
  if (membersBefore.length !== 3 || membersBefore.some(p => p.tracks.length === 0)) {
    throw new Error('Provider did not expose three actual browser media participants');
  }
  events.push({ beforeEviction: membersBefore.map(p => ({ identity: p.identity, tracks: p.tracks.length })) });
  await service.removeParticipant(roomName, 'learner-a', {
    revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
  });
  await learnerA.page.waitForFunction(() => window.__room?.state === 'disconnected', { timeout: 15000 });
  const disconnectReason = await learnerA.page.evaluate(() => window.__disconnectReason);
  const membersAfter = await service.listParticipants(roomName);
  if (membersAfter.length !== 2 || membersAfter.some(p => p.identity === 'learner-a')) {
    throw new Error('Provider did not disconnect revoked learner or removed other participants');
  }
  events.push({ eviction: true, disconnectedReason: disconnectReason,
    remainingIdentities: membersAfter.map(p => p.identity).sort() });
  const oldTokenAttempt = await learnerA.page.evaluate(async ({ url, jwt }) => {
    const room = new LivekitClient.Room();
    try {
      await room.connect(url, jwt, { autoSubscribe: true, maxRetries: 0 });
      await room.disconnect();
      return { unexpectedlyReconnected: true };
    } catch (error) {
      return { rejected: true, reason: error instanceof Error ? error.name : 'unknown' };
    }
  }, { url: testUrl, jwt: learnerA.token });
  events.push({ oldTokenAttempt });
  // Explicitly report rejoin behavior: token revocation differs between cloud
  // and self-hosted servers. A rejoin is a finding, never hidden as a PASS.
  if (oldTokenAttempt.unexpectedlyReconnected) {
    conclusion = 'PARTIAL_TOKEN_REPLAY_NOT_PREVENTED';
  } else {
    conclusion = 'LOCAL_PROVIDER_PASS';
  }
  // Keep the other browser clients present until all assertions completed.
  void instructor;
  void learnerB;
} catch (error) {
  events.push({ error: error instanceof Error ? error.message : String(error) });
  conclusion = 'FAIL';
} finally {
  await Promise.allSettled(contexts.map(c => c.close()));
  await browser.close();
  await service.deleteRoom(roomName).catch(() => {});
}
const result = {
  environment: 'isolated local LiveKit OSS 1.13.10 / Chromium WebRTC fake devices',
  kind: 'REAL_PROVIDER_LOCAL_NOT_PRODUCTION_OR_CUSTOMER_UI',
  conclusion,
  checks: events,
};
writeFileSync(`${outputFolder}/livekit-local-provider-result.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
if (conclusion !== 'LOCAL_PROVIDER_PASS') process.exitCode = 1;
