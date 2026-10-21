/**
 * Manual, isolated LiveKit CLOUD acceptance.
 * Only uses an authorized non-customer Cloud project, never production learner IDs.
 * Refuses self-hosted servers so Cloud-only JWT revocation cannot be falsely certified.
 */
import { chromium } from '@playwright/test';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';

const target = process.env.LIVEKIT_CLOUD_TEST_URL || '';
const apiKey = process.env.LIVEKIT_CLOUD_TEST_API_KEY || '';
const apiSecret = process.env.LIVEKIT_CLOUD_TEST_API_SECRET || '';
const outputFile = 'evidence/live-classroom-acceptance/cloud-post-setting-20261021/cloud-provider-verification.json';

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
  executablePath: '/usr/bin/chromium',
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
  // Project-level independent guard: test a never-created room before any
  // other room is made/deleted. Token grants roomJoin, not roomCreate.
  const orphanFirst=await createBrowser('new-room-attempt',roomNotCreated);
  const firstResult=await orphanFirst.page.evaluate(async ({ws,jwt})=>{
    const probe=new LivekitClient.Room();
    try {
      await probe.connect(ws,jwt,{maxRetries:0});
      await probe.disconnect();
      return {connected:true};
    }catch(error){
      return {connected:false,reason:error?.reason??null,
        type:error?.name??'unknown'};
    }
  },{ws:target,jwt:orphanFirst.credential});
  const createdOnFirst=await api.listRooms([roomNotCreated]);
  if(firstResult.connected || createdOnFirst.length>0){
    throw new Error('NO-GO: fresh roomJoin JWT created a never-before-existing room');
  }
  if(![0,7].includes(firstResult.reason)){
    throw new Error('INCONCLUSIVE: new-room rejection lacked an authorization reason: '+
      JSON.stringify({reason:firstResult.reason,type:firstResult.type}));
  }
  checks.push({action:'automatic_room_creation_disabled_fresh_room_first',
    passed:true,rejectionReason:firstResult.reason});
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
  // Cloud RoomService participant snapshots are eventually consistent after
  // WebRTC publish. Wait for real observed tracks instead of a single read.
  let participants=[];
  const publicationDeadline=Date.now()+20000;
  while(Date.now()<publicationDeadline) {
    participants=await api.listParticipants(room);
    if(participants.length===3 && participants.every(p=>p.tracks.length>=2))break;
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  if (participants.length !== 3 || participants.some((p) => p.tracks.length < 2)) {
    throw new Error('Cloud media tracks missing after 20s: roles='+
      participants.length+' counts='+participants.map(p=>p.tracks.length).join(','));
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
    } catch (error) {
      return { rejected: true, reason: error?.reason ?? null,
        errorType: error?.name ?? 'unknown',
        isExpectedDenial: [LivekitClient.ConnectionErrorReason.NotAllowed,
          LivekitClient.ConnectionErrorReason.ServiceNotFound].includes(error?.reason) };
    }
  }, { ws: target, jwt: first.credential });
  if (!replay.rejected || !replay.isExpectedDenial) {
    throw new Error('NO-GO: revoked JWT replay was accepted or failed for a non-auth reason: '+
      JSON.stringify({rejected:replay.rejected,reason:replay.reason,
        errorType:replay.errorType}));
  }
  checks.push({ action: 'old_token_replay_denied', passed: true,
    errorReason:replay.reason });

  // Safe end-for-everyone requires explicit credential revocation before
  // DeleteRoom. Disabling auto-creation blocks *never-created* rooms, but
  // Cloud may still accept a cached JWT for a previously-existing room unless
  // the original instructor/student identities are also revoked.
  const closeCutoff=BigInt(Math.floor(Date.now()/1000)+1);
  await api.removeParticipant(room,instructor.identity,{revokeTokenTs:closeCutoff});
  await api.removeParticipant(room,second.identity,{revokeTokenTs:closeCutoff});
  checks.push({action:'close_revoke_all_remaining_media_identities',
    passed:true,revoked:2});
  await api.deleteRoom(room);
  // A DeleteRoom response alone does not prove absence across signaling nodes.
  // Require two Cloud API reads before testing replay of the old token.
  let stableAbsent=0;
  const absenceDeadline=Date.now()+15000;
  while(Date.now()<absenceDeadline && stableAbsent<2) {
    const found=await api.listRooms([room]);
    if(found.length===0)stableAbsent++;
    else stableAbsent=0;
    if(stableAbsent<2)await new Promise(resolve=>setTimeout(resolve,600));
  }
  if(stableAbsent<2) {
    throw new Error('NO-GO: Cloud API cannot confirm completed room is absent');
  }
  checks.push({action:'room_delete_absence_confirmed_at_provider',passed:true});
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
      return { incorrectlyRecreated: true,connected:true };
    } catch (error) {
      return { rejected:true,connected:false,reason:error?.reason ?? null,
        errorType:error?.name ?? 'unknown',
        isExpectedDenial:[LivekitClient.ConnectionErrorReason.NotAllowed,
          LivekitClient.ConnectionErrorReason.ServiceNotFound].includes(error?.reason)};
    }
  }, { ws: target, jwt: instructor.credential });
  if (!closedRoomReplay.rejected || !closedRoomReplay.isExpectedDenial) {
    throw new Error('NO-GO: closed room replay accepted or errored without auth denial: '+
      JSON.stringify({rejected:closedRoomReplay.rejected,
        connected:closedRoomReplay.connected===true,reason:closedRoomReplay.reason,
        errorType:closedRoomReplay.errorType}));
  }
  checks.push({ action: 'closed_room_cached_token_denied', passed: true,
    errorReason:closedRoomReplay.reason });
  const orphan = await createBrowser('orphan-learner', roomNotCreated);
  const autoCreate = await orphan.page.evaluate(async ({ ws, jwt }) => {
    const room = new LivekitClient.Room();
    try {
      await room.connect(ws, jwt, { maxRetries: 0 });
      await room.disconnect();
      return true;
    } catch (error) {
      return { connected:false,reason:error?.reason ?? null,
        errorType:error?.name ?? 'unknown',
        expectedDenial:[LivekitClient.ConnectionErrorReason.NotAllowed,
          LivekitClient.ConnectionErrorReason.ServiceNotFound].includes(error?.reason)};
    }
  }, { ws: target, jwt: orphan.credential });
  const unexpectedRoom=await api.listRooms([roomNotCreated]);
  if (autoCreate === true || autoCreate?.connected===true ||
      unexpectedRoom.length!==0 || !autoCreate?.expectedDenial) {
    throw new Error('NO-GO: automatic room creation not securely denied: '+
      JSON.stringify({created:unexpectedRoom.length, connected:autoCreate===true,
        reason:autoCreate?.reason??null,errorType:autoCreate?.errorType??null}));
  }
  checks.push({ action: 'automatic_room_creation_disabled', passed:true,
    responseReason:autoCreate.reason,providerRoomExists:false });
  checks.push({ action: 'finish_for_everyone_disconnects_all', passed: true });
  // The negative checks must not pass merely because WebRTC signaling is down.
  // Prove the same Cloud endpoint still accepts an authorized fresh room.
  const positiveControl='luma_cloud_positive_'+randomUUID().replaceAll('-','');
  await api.createRoom({name:positiveControl,maxParticipants:2,emptyTimeout:60});
  try {
    const control=await createBrowser('health-control',positiveControl);
    const joined=await connect(control,{camera:false});
    if (joined.room!=='connected' || joined.audioTracks<1) {
      throw new Error('NO-GO: positive control missing genuine Cloud audio');
    }
    checks.push({action:'post_denial_positive_control_cloud_available',passed:true});
  } finally {
    await api.deleteRoom(positiveControl).catch(()=>undefined);
  }
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
  environment: 'authorized LiveKit Cloud LUMA QA project, three synthetic Chromium WebRTC peers',
  kind: 'CLOUD_PROVIDER_AND_EXPLICIT_CREDENTIAL_REVOCATION_AFTER_PROJECT_POLICY_FIX',
  cloudProjectId: 'p_5650huuc5om',
  sourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  conclusion,
  checkedAt: new Date().toISOString(),
  checks,
};
mkdirSync('evidence/live-classroom-acceptance/cloud-post-setting-20261021', { recursive: true });
writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
if (conclusion !== 'PROVIDER_CLOUD_PASS') process.exitCode = 1;
