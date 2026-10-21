/**
 * Independent postdeploy observation of the two public LUMA entrypoints.
 * Runtime health != source or customer-UAT approval. The deployment cannot be
 * finalized if its proxy and the origin disagree about the exact signed SHA.
 */
import { assertManifest, invariant, PRODUCTION_URL } from './policy.mjs';

export const LUMA_PUBLIC_ORIGIN = 'https://luma.lch-app.cloud';
export const LUMA_RUNTIME_ENDPOINTS = Object.freeze([
  Object.freeze({ name: 'firebase-apphosting', origin: PRODUCTION_URL }),
  Object.freeze({ name: 'public-cloudflare', origin: LUMA_PUBLIC_ORIGIN }),
]);

function expectedEndpoint(item) {
  return LUMA_RUNTIME_ENDPOINTS.find(endpoint =>
    endpoint.name === item.name && endpoint.origin === item.origin);
}

/** Check the immutable release provenance, not a matching short SHA prefix. */
export function assertServingRuntimeParity(observations, expectedManifest) {
  assertManifest(expectedManifest);
  invariant(Array.isArray(observations) &&
    observations.length === LUMA_RUNTIME_ENDPOINTS.length,
    'Both public LUMA endpoints must be observed before release finalization');
  const names = new Set();
  for (const item of observations) {
    invariant(item && expectedEndpoint(item) && !names.has(item.name),
      'Unexpected or duplicated LUMA production endpoint');
    names.add(item.name);
    invariant(item.versionHttp === 200 && item.healthHttp === 200 &&
      item.learnerHttp === 200,
      `LUMA runtime HTTP check failed on ${item.name}`);
    invariant(new URL(item.versionResponseUrl).origin === item.origin &&
      new URL(item.healthResponseUrl).origin === item.origin &&
      new URL(item.learnerResponseUrl).origin === item.origin,
      `LUMA endpoint redirected to an unapproved host: ${item.name}`);
    assertManifest(item.version, expectedManifest.gitSha);
    invariant(item.version.gitTree === expectedManifest.gitTree &&
      item.version.runId === expectedManifest.runId &&
      item.version.commitTime === expectedManifest.commitTime,
      `LUMA runtime deployment manifest mismatch: ${item.name}`);
    invariant(item.health?.status === 'ok' &&
      item.health?.checks?.api === 'ok' &&
      item.health?.checks?.firestore === 'ok',
      `LUMA runtime is unhealthy: ${item.name}`);
  }
  invariant(names.size === LUMA_RUNTIME_ENDPOINTS.length,
    'LUMA runtime parity coverage is incomplete');
  return {
    status: 'PASS', sha: expectedManifest.gitSha, runId: expectedManifest.runId,
    endpoints: observations.map(item => ({
      name: item.name, origin: item.origin,
      sha: item.version.gitSha, runId: item.version.runId,
      versionHttp: item.versionHttp, healthHttp: item.healthHttp,
      learnerHttp: item.learnerHttp,
    })),
  };
}

/** Public GETs only. No Auth JWT, Firebase mutation or Cloud traffic write. */
export async function verifyPublicRuntimeParity(request, expectedManifest) {
  const checks = [];
  for (const endpoint of LUMA_RUNTIME_ENDPOINTS) {
    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const options = {
      timeout: 30000,
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      failOnStatusCode: false,
    };
    const version = await request.get(`${endpoint.origin}/api/version?release_audit=${nonce}`,options);
    const health = await request.get(`${endpoint.origin}/api/health?release_audit=${nonce}`,options);
    const learner = await request.get(`${endpoint.origin}/learn?release_audit=${nonce}`,options);
    checks.push({
      name: endpoint.name, origin: endpoint.origin,
      versionHttp: version.status(), healthHttp: health.status(),
      learnerHttp: learner.status(),
      versionResponseUrl: version.url(), healthResponseUrl: health.url(),
      learnerResponseUrl: learner.url(),
      version: version.ok() ? await version.json() : null,
      health: health.ok() ? await health.json() : null,
    });
  }
  return assertServingRuntimeParity(checks,expectedManifest);
}
