/**
 * Manual, isolated LiveKit CLOUD acceptance.
 * Only uses an authorized non-customer Cloud project, never production learner IDs.
 * Refuses self-hosted servers so Cloud-only JWT revocation cannot be falsely certified.
 */
import { chromium } from '@playwright/test';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';

const target = process.env.LIVEKIT_CLOUD_TEST_URL || '';
const apiKey = process.env.LIVEKIT_CLOUD_TEST_API_KEY || '';
const apiSecret = process.env.LIVEKIT_CLOUD_TEST_API_SECRET || '';
const outputFile = 'evidence/live-classroom-acceptance/cloud-enterprise-verification.json';

let url;
try { url = new URL(target); } catch { /* rejected below */ }
if (!url || url.protocol !== 'wss:' || !url.hostname.endsWith('.livekit.cloud') ||
    url.username || url.password || url.pathname !== '/' || !apiKey || !apiSecret) {
  throw new Error('BLOCKED: Cloud-only E2E requires a dedicated wss://*.livekit.cloud project and protected secrets');
}
const endpoint = new URL(url);
endpoint.protocol = 'https:';
const api = new RoomServiceClient(endpoint.toString(), apiKey, apiSecret);
const room = 'luma_enterprise_gate_' + randomUUID().replaceAll('-', '');
const roomNotCreated = 'luma_auto_create_guard_' + randomUUID().replaceAll('-', '');
// A loopback HTML document provides a deterministic, browser-secure context for
// camera/mic permissions. LiveKit Cloud's API endpoint is not a user-facing webpage.
const fixtureServer = createServer((_request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end('<!doctype html><html><head><title>LUMA Media Acceptance</title></head><body></body></html>');
});
await new Promise((resolve, reject) => {
  fixtureServer.once('error', reject);
  fixtureServer.listen(0, '127.0.0.1', resolve);
});
const address = fixtureServer.address();
if (!address || typeof address === 'string') {
  throw new Error('Cannot start isolated loopback media test fixture');
}
const fixtureOrigin = 'http://127.0.0.1:' + address.port;
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const contexts = [];
const checks = [];
let conclusion = 'FAIL';

async function token(identity, roomName) {
  const t = new AccessToken(apiKey, apiSecret, { identity, name: identity, ttl: '90s' });
  t.addGrant({
    room: roomName, roomJoin: true, roomCreate: false, roomAdmin: false, roomRecord: false,
    canPublishData: true, canSubscribe: true,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE,
      ...(identity === 'instructor' ? [TrackSource.SCREEN_SHARE] : [])],
  });
  return t.toJwt();
}

async function createBrowser(identity, roomName = room) {
  const context = await browser.newContext({ permissions: ['microphone', 'camera'] });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(fixtureOrigin, { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: 'node_modules/livekit-client/dist/livekit-client.umd.js' });
  const credential = await token(identity, roomName);
  return { page, identity, credential };
}

async function connect(user, { camera = true } = {}) {
  return user.page.evaluate(async ({ ws, jwt, camera }) => {
    const room = new LivekitClient.Room({ autoSubscribe: true, adaptiveStream: true });
    window.__room = room;
    window.__seenData = [];
    window.__disconnected = null;
    room.on(LivekitClient.RoomEvent.DataReceived, (data) => {
      window.__seenData.push(new TextDecoder().decode(data));
    });
    room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
      window.__disconnected = String(reason);
    });
    await room.connect(ws, jwt, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    if (camera) await room.localParticipant.setCameraEnabled(true);
    return {
      room: room.state,
      audioTracks: room.localParticipant.audioTrackPublications.size,
      videoTracks: room.localParticipant.videoTrackPublications.size,
    };
  }, { ws: target, jwt: user.credential, camera });
}

try {
  await api.createRoom({ name: room, maxParticipants: 5, emptyTimeout: 90 });
  const instructor = await createBrowser('instructor');
  const first = await createBrowser('learner-one');
  const second = await createBrowser('learner-two');
  for (const user of [instructor, first, second]) {
    const result = await connect(user);
    if (result.room !== 'connected' || result.audioTracks < 1 || result.videoTracks < 1) {
      throw new Error(user.identity + ': missing actual WebRTC camera/microphone publication');
    }
    checks.push({ action: 'webrtc_publish', role: user.identity, passed: true });
  }
  // Cloud publisher snapshots are eventually consistent; poll instead of a single read.
  let participants = [];
  const publicationDeadline = Date.now() + 20000;
  while (Date.now() < publicationDeadline) {
    participants = await api.listParticipants(room);
    if (participants.length === 3 && participants.every((p) => p.tracks.length >= 2)) break;
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  if (participants.length !== 3 || participants.some((p) => p.tracks.length < 2)) {
    throw new Error('Cloud media tracks missing after 20s: roles=' +
      participants.length + ' counts=' + participants.map((p) => p.tracks.length).join(','));
  }
  await instructor.page.evaluate(async () => {
    const payload = new TextEncoder().encode('luma-acceptance-synthetic-chat');
    await window.__room.localParticipant.publishData(payload, { reliable: true });
  });
  await first.page.waitForFunction(() =>
    window.__seenData.includes('luma-acceptance-synthetic-chat'), undefined, { timeout: 10_000 });
  checks.push({ action: 'instructor_data_chat_to_learner', passed: true });

  // Connected learner is forcibly disconnected; unaffected learners stay online.
  await api.removeParticipant(room, first.identity, {
    revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
  });
  await first.page.waitForFunction(() => window.__room?.state === 'disconnected', undefined, {
    timeout: 15_000,
  });
  const remaining = await api.listParticipants(room);
  if (remaining.length !== 2 || remaining.some((p) => p.identity === first.identity)) {
    throw new Error('Cloud revocation disconnected the wrong set of participants');
  }
  checks.push({ action: 'connected_learner_removed', passed: true, remaining: 2 });

  // Cloud-only authorization boundary: the very same cached token MUST be rejected.
  const replay = await first.page.evaluate(async ({ ws, jwt }) => {
    const room = new LivekitClient.Room();
    try {
      await room.connect(ws, jwt, { maxRetries: 0 });
      await room.disconnect();
      return { unauthorized: true };
    } catch {
      return { rejected: true };
    }
  }, { ws: target, jwt: first.credential });
  if (!replay.rejected) throw new Error('NO-GO: old revoked JWT rejoined LiveKit Cloud');
  checks.push({ action: 'old_token_replay_denied', passed: true });

  // A completion API delete must not be reversible using an orphaned JWT.
  await api.deleteRoom(room);
  await instructor.page.waitForFunction(() => window.__room?.state === 'disconnected', undefined, {
    timeout: 15_000,
  });
  await second.page.waitForFunction(() => window.__room?.state === 'disconnected', undefined, {
    timeout: 15_000,
  });
  // End-for-everyone must also fence a previously joined instructor's cached
  // roomJoin JWT, not merely a JWT for a room that never existed.
  const closedRoomReplay = await instructor.page.evaluate(async ({ ws, jwt }) => {
    const test = new LivekitClient.Room();
    try {
      await test.connect(ws, jwt, { maxRetries: 0 });
      await test.disconnect();
      return { incorrectlyRecreated: true };
    } catch {
      return { rejected: true };
    }
  }, { ws: target, jwt: instructor.credential });
  if (!closedRoomReplay.rejected) {
    throw new Error('NO-GO: instructor cached JWT recreated a completed Cloud room');
  }
  checks.push({ action: 'closed_room_cached_token_denied', passed: true });
  const orphan = await createBrowser('orphan-learner', roomNotCreated);
  const autoCreate = await orphan.page.evaluate(async ({ ws, jwt }) => {
    const room = new LivekitClient.Room();
    try {
      await room.connect(ws, jwt, { maxRetries: 0 });
      await room.disconnect();
      return true;
    } catch {
      return false;
    }
  }, { ws: target, jwt: orphan.credential });
  if (autoCreate) throw new Error('NO-GO: Cloud project auto-created a room from a cached roomJoin JWT');
  checks.push({ action: 'automatic_room_creation_disabled', passed: true });
  checks.push({ action: 'finish_for_everyone_disconnects_all', passed: true });
  conclusion = 'PROVIDER_CLOUD_PASS';
} catch (error) {
  checks.push({
    action: 'failure',
    passed: false,
    error: error instanceof Error ? error.message : 'unknown',
  });
} finally {
  await Promise.allSettled(contexts.map((c) => c.close()));
  await browser.close();
  await new Promise((resolve) => fixtureServer.close(resolve));
  await api.deleteRoom(room).catch(() => undefined);
  await api.deleteRoom(roomNotCreated).catch(() => undefined);
}
const report = {
  environment: 'dedicated LiveKit Cloud project, three isolated Chromium WebRTC peers',
  kind: 'PROVIDER_CLOUD_ONLY_NOT_AUTHENTICATED_LUMA_APP_E2E',
  conclusion,
  checkedAt: new Date().toISOString(),
  checks,
};
mkdirSync('evidence/live-classroom-acceptance', { recursive: true });
writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (conclusion !== 'PROVIDER_CLOUD_PASS') process.exitCode = 1;
