/**
 * LUMA Zoom-alternative verification: synthetic browsers + actual LiveKit OSS WebRTC.
 * This does not exercise Firebase authentication or the LUMA customer UI.
 * Launch only against loopback LiveKit. Never print JWTs or provider secrets.
 */
import { chromium } from '@playwright/test';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const url = process.env.LIVEKIT_TEST_URL;
const key = process.env.LIVEKIT_TEST_KEY;
const secret = process.env.LIVEKIT_TEST_SECRET;
if (!/^ws:\/\/127\.0\.0\.1:\d+$/.test(url ?? '') || !key || !secret) {
  throw new Error('Loopback LIVEKIT_TEST_URL and synthetic local key/secret required');
}
const outputDir = 'evidence/live-classroom-acceptance/qa-20261020-initial';
mkdirSync(outputDir, { recursive: true });
const roomName = 'zoomqa_' + randomUUID().replaceAll('-', '');
const service = new RoomServiceClient(url.replace('ws:', 'http:'), key, secret);
const startedAt = new Date().toISOString();
const facts = [];
const results = { startedAt, sourceSha: process.env.QA_SOURCE_SHA ?? 'unknown',
  environment: 'LiveKit OSS v1.13.10 loopback with 3 isolated Chromium contexts and fake AV devices',
  classification: 'LOCAL_PROVIDER_REAL_WEBRTC_NOT_CLOUD_NOT_LUMA_AUTHENTICATED',
  checks: facts, overall: 'NOT_FINISHED' };
let browser;
const contexts = [];
async function newToken(identity) {
  const at = new AccessToken(key, secret, { identity, name: identity, ttl: '5m' });
  at.addGrant({ room: roomName, roomJoin: true, roomCreate: false,
    canPublish: true, canPublishData: true, canSubscribe: true });
  return at.toJwt();
}
async function join(identity) {
  const context = await browser.newContext({ permissions: ['microphone','camera'] });
  contexts.push(context);
  const page = await context.newPage();
  await page.goto(url.replace('ws:', 'http:'), { waitUntil: 'domcontentloaded' });
  await page.addScriptTag({ path: 'node_modules/livekit-client/dist/livekit-client.umd.js' });
  const token = await newToken(identity);
  const connected = await page.evaluate(async ({ url, token }) => {
    const lk = window.LivekitClient;
    const room = new lk.Room({ autoSubscribe: true, adaptiveStream: false });
    window.qaRoom = room;
    window.qaDisconnectReason = null;
    room.on(lk.RoomEvent.Disconnected, reason => { window.qaDisconnectReason = String(reason); });
    room.on(lk.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      const el = track.attach();
      el.dataset.qaPeer = participant.identity;
      el.dataset.qaKind = track.kind;
      el.autoplay = true;
      if (track.kind === 'video') el.muted = true;
      document.body.appendChild(el);
      el.play?.().catch(() => {});
    });
    await room.connect(url, token, { autoSubscribe: true });
    await room.localParticipant.setMicrophoneEnabled(true);
    await room.localParticipant.setCameraEnabled(true);
    return { state: room.state, publisherAudio: room.localParticipant.audioTrackPublications.size,
      publisherVideo: room.localParticipant.videoTrackPublications.size };
  }, { url, token });
  if (connected.state !== 'connected' || connected.publisherAudio < 1 || connected.publisherVideo < 1) {
    throw new Error(identity + ': local AV publisher failed: ' + JSON.stringify(connected));
  }
  facts.push({ id: 'published-' + identity, result: 'PASS', ...connected });
  return { page, token };
}
async function checkRemote(page, expectedPeers, id) {
  await page.waitForFunction(count => {
    const room = window.qaRoom;
    if (!room || room.state !== 'connected' || room.remoteParticipants.size < count) return false;
    const remotes = [...room.remoteParticipants.values()];
    return remotes.filter(p => {
      const tracks = [...p.trackPublications.values()];
      return tracks.some(t => t.kind === 'audio' && t.isSubscribed && t.track?.mediaStreamTrack?.readyState === 'live') &&
        tracks.some(t => t.kind === 'video' && t.isSubscribed && t.track?.mediaStreamTrack?.readyState === 'live');
    }).length >= count && [...document.querySelectorAll('video[data-qa-peer]')]
      .filter(v => v.videoWidth > 0 && v.videoHeight > 0).length >= count;
  }, expectedPeers, { timeout: 30000 });
  const state = await page.evaluate(() => ({
    connected: window.qaRoom.state,
    peers: [...window.qaRoom.remoteParticipants.keys()].sort(),
    decodedRemoteVideos: [...document.querySelectorAll('video[data-qa-peer]')]
      .filter(v => v.videoWidth > 0 && v.videoHeight > 0).length,
    liveRemoteAudio: [...window.qaRoom.remoteParticipants.values()].reduce((sum, p) =>
      sum + [...p.trackPublications.values()].filter(t => t.kind === 'audio' &&
        t.isSubscribed && t.track?.mediaStreamTrack?.readyState === 'live').length, 0),
  }));
  facts.push({ id, result: 'PASS', ...state });
  return state;
}
try {
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  await service.createRoom({ name: roomName, maxParticipants: 5, emptyTimeout: 60,
    metadata: JSON.stringify({ recordingPolicy: 'none', test: 'synthetic-local' }) });
  const instructor = await join('instructor');
  const learnerA = await join('learner-a');
  const learnerB = await join('learner-b');
  const membersBefore = await service.listParticipants(roomName);
  if (membersBefore.length !== 3 ||
      membersBefore.some(p => p.tracks.filter(t => t.type === 0 || t.type === 1).length < 2)) {
    // Actual audio/video publications are also verified in the browser assertions below.
    facts.push({ id: 'provider-tracks-before', count: membersBefore.length,
      tracks: membersBefore.map(p => ({ identity: p.identity, count: p.tracks.length })) });
  }
  await Promise.all([
    checkRemote(instructor.page, 2, 'instructor-receives-two-remote-av'),
    checkRemote(learnerA.page, 2, 'learner-a-receives-two-remote-av'),
    checkRemote(learnerB.page, 2, 'learner-b-receives-two-remote-av'),
  ]);
  const micMute = await learnerB.page.evaluate(async () => {
    await window.qaRoom.localParticipant.setMicrophoneEnabled(false);
    return { enabled: window.qaRoom.localParticipant.isMicrophoneEnabled };
  });
  if (micMute.enabled !== false) throw new Error('learner-b mic mute did not change publisher state');
  const micUnmute = await learnerB.page.evaluate(async () => {
    await window.qaRoom.localParticipant.setMicrophoneEnabled(true);
    return { enabled: window.qaRoom.localParticipant.isMicrophoneEnabled };
  });
  if (micUnmute.enabled !== true) throw new Error('learner-b mic unmute did not change publisher state');
  facts.push({ id: 'learner-local-microphone-toggle', result: 'PASS', micMute, micUnmute });
  const cameraMute = await learnerB.page.evaluate(async () => {
    await window.qaRoom.localParticipant.setCameraEnabled(false);
    return { enabled: window.qaRoom.localParticipant.isCameraEnabled };
  });
  if (cameraMute.enabled !== false) throw new Error('learner-b camera off did not change publisher state');
  const cameraUnmute = await learnerB.page.evaluate(async () => {
    await window.qaRoom.localParticipant.setCameraEnabled(true);
    return { enabled: window.qaRoom.localParticipant.isCameraEnabled };
  });
  if (cameraUnmute.enabled !== true) throw new Error('learner-b camera on did not change publisher state');
  facts.push({ id: 'learner-local-camera-toggle', result: 'PASS', cameraMute, cameraUnmute });
  const removeIssuedAtMs = Date.now();
  await service.removeParticipant(roomName, 'learner-a', { revokeTokenTs: BigInt(Math.floor(Date.now()/1000)+1) });
  await learnerA.page.waitForFunction(() => window.qaRoom?.state === 'disconnected',
    undefined, { timeout: 15000 });
  const disconnectedObservedAtMs = Date.now();
  await Promise.all([
    instructor.page.waitForFunction(() => window.qaRoom?.state === 'connected' &&
      !window.qaRoom.remoteParticipants.has('learner-a'), undefined, { timeout: 15000 }),
    learnerB.page.waitForFunction(() => window.qaRoom?.state === 'connected' &&
      !window.qaRoom.remoteParticipants.has('learner-a'), undefined, { timeout: 15000 })
  ]);
  const membersAfter = await service.listParticipants(roomName);
  if (membersAfter.length !== 2 || membersAfter.some(p => p.identity === 'learner-a')) {
    throw new Error('Eviction left an unauthorized participant in the provider roster');
  }
  facts.push({ id: 'evict-learner-preserve-other-media', result: 'PASS',
    removalToObservedDisconnectMs: disconnectedObservedAtMs-removeIssuedAtMs,
    observedDisconnectedReason: await learnerA.page.evaluate(() => window.qaDisconnectReason),
    remaining: membersAfter.map(p=>p.identity).sort() });
  const oldTokenRejoin = await learnerA.page.evaluate(async ({ url, token }) => {
    const room = new window.LivekitClient.Room({ autoSubscribe: true });
    try {
      await room.connect(url, token, { maxRetries: 0 });
      await room.disconnect();
      return { accepted: true };
    } catch (error) {
      return { accepted: false, errorType: error?.name ?? 'unknown' };
    }
  }, { url, token: learnerA.token });
  facts.push({ id: 'old-jwt-after-expulsion', provider: 'LiveKit OSS', result: oldTokenRejoin.accepted ?
    'FAIL_EXPECTED_LOCAL_OSS_TOKEN_REPLAY' : 'PASS_LOCAL_TOKEN_REJECTED', ...oldTokenRejoin });
  results.overall = oldTokenRejoin.accepted ?
    'PARTIAL_LOCAL_AV_EVICTION_PASS_OLD_JWT_REPLAY_NOT_BLOCKED' : 'LOCAL_AV_EVICTION_AND_REPLAY_PASS';
} catch (error) {
  results.overall = 'FAIL';
  results.error = error instanceof Error ? error.message : String(error);
} finally {
  await Promise.allSettled(contexts.map(c => c.close()));
  if (browser) await browser.close();
  await service.deleteRoom(roomName).catch(()=>{});
  results.finishedAt = new Date().toISOString();
  writeFileSync(outputDir + '/livekit-multimedia-provider.json', JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(results,null,2));
}
if (results.overall === 'FAIL') process.exitCode = 1;
