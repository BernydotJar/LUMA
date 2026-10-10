import { GoogleAuth } from 'google-auth-library';
import { verifyReview } from './review-gate.mjs';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { assertDeployContext, assertManifest, assertQualityJobs, buildIdFromName, invariant, PARENT, PROJECT, PRODUCTION_URL, REPOSITORY, singleServingBuild, SOURCE_BUCKET } from './policy.mjs';

const apiRoot = 'https://firebaseapphosting.googleapis.com/v1beta/';
const out = resolve(process.env.RELEASE_DIR ?? '/tmp/luma-release');
mkdirSync(out, { recursive: true });
const ledgerPath = resolve(out, 'release-result.json');
const manifest = assertManifest(JSON.parse(readFileSync(resolve(out, 'manifest.json'), 'utf8')), process.env.GITHUB_SHA);
let ledger = { schemaVersion: 1, gitSha: manifest.gitSha, runId: manifest.runId, project: PROJECT, backend: 'luma', status: 'STARTED', events: [] };
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
function record(phase, details = {}) {
  const previousHash = ledger.events.at(-1)?.hash ?? null;
  const event = { phase, at: new Date().toISOString(), previousHash, ...details };
  const hash = createHash('sha256').update(JSON.stringify(event)).digest('hex');
  ledger.events.push({ ...event, hash });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  console.log(phase);
}
async function cloud(path, method = 'GET', data, params) {
  const client = await auth.getClient();
  const response = await client.request({ url: apiRoot + path, method, data, params, timeout: 60000, retry: false });
  return response.data;
}
async function github(path) {
  invariant(process.env.GH_TOKEN, 'GitHub read token is required');
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30000),
  });
  invariant(response.ok, `GitHub verification failed: HTTP ${response.status}`);
  return response.json();
}
async function verifyGitHub() {
  assertDeployContext(process.env, manifest);
  const branch = await github('branches/main');
  invariant(branch.protected === true, 'main is not protected');
  invariant(branch.commit.sha === manifest.gitSha, 'A newer main commit superseded this candidate');
  const run = await github(`actions/runs/${manifest.runId}`);
  invariant(run.head_sha === manifest.gitSha && run.event === 'push' && run.head_branch === 'main', 'Workflow provenance mismatch');
  const jobs = [];
  for (let page = 1; ; page++) {
    const response = await github(`actions/runs/${manifest.runId}/jobs?filter=latest&per_page=100&page=${page}`);
    jobs.push(...response.jobs);
    if (jobs.length >= response.total_count) break;
  }
  assertQualityJobs(jobs);
}
async function poll(read, accept, fail, label, timeoutMs = 25 * 60 * 1000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await read();
    invariant(!fail(value), `${label} entered a failed state`);
    if (accept(value)) return value;
    await delay(5000);
  }
  throw new Error(`${label} exceeded its deadline`);
}
async function waitOperation(operation) {
  if (!operation.name?.includes('/operations/')) return operation;
  return poll(() => cloud(operation.name), value => value.done === true, value => Boolean(value.error), 'App Hosting operation');
}
async function fetchVersion() {
  const response = await fetch(`${PRODUCTION_URL}/api/version?verification=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  if (!response.ok) return null;
  try { return assertManifest(await response.json()); } catch { return null; }
}
async function waitServing(buildId, sha) {
  await poll(() => cloud(`${PARENT}/traffic`), value => {
    try { return singleServingBuild(value) === buildId; } catch { return false; }
  }, () => false, 'Production traffic', 10 * 60 * 1000);
  if (sha) await poll(fetchVersion, value => value?.gitSha === sha, () => false, 'Production SHA', 5 * 60 * 1000);
}
function assertCapacity(build) {
  const config = build.config?.runConfig;
  invariant(config?.cpu === 1 && config.memoryMib === 512 && config.maxInstances === 2 && (config.minInstances ?? 0) === 0 && config.concurrency === 80, 'Production capacity drift; release blocked');
}
async function deploy() {
  const approval = verifyReview();
  record('INDEPENDENT_GRAPH_GATE_VERIFIED', { sourceDigest: approval.sourceDigest, graphEventId: approval.graphEventId });
  await verifyGitHub();
  const backend = await cloud(PARENT);
  invariant(backend.uri === new URL(PRODUCTION_URL).host && !backend.reconciling, 'Unexpected or reconciling backend');
  invariant(!backend.codebase?.repository, 'Native repository linkage requires a release-policy review');
  const before = await cloud(`${PARENT}/traffic`);
  const previousId = singleServingBuild(before);
  const previous = await cloud(`${PARENT}/builds/${previousId}`);
  invariant(previous.state === 'READY', 'Prior serving build is not ready');
  const version = await fetchVersion();
  let knownGood = false;
  const priorRunId = previous.labels?.['github-run'];
  if (version && previous.labels?.['git-sha'] === version.gitSha && previous.labels?.['deployment-tool'] === 'luma-gated-actions' && /^\d+$/.test(priorRunId ?? '')) {
    const priorRun = await github(`actions/runs/${priorRunId}`);
    const priorJobs = await github(`actions/runs/${priorRunId}/jobs?filter=latest&per_page=100`);
    knownGood = priorRun.conclusion === 'success' && priorRun.head_sha === version.gitSha && priorRun.event === 'push' && priorRun.head_branch === 'main' && priorRun.path === '.github/workflows/quality.yml' && priorJobs.jobs.some(job => job.name === 'deploy' && job.conclusion === 'success');
  }
  ledger.previous = { buildId: previousId, gitSha: version?.gitSha ?? null, knownGood };
  record('PREFLIGHT_PASSED', { previous: ledger.previous });
  const bytes = readFileSync(resolve(out, 'source.zip'));
  const digest = createHash('sha256').update(bytes).digest('hex');
  invariant(digest === manifest.archiveSha256, 'Source artifact digest mismatch');
  const attempt = process.env.GITHUB_RUN_ATTEMPT;
  invariant(/^\d+$/.test(attempt ?? ''), 'Invalid run attempt');
  const buildId = `gh-${manifest.gitSha.slice(0, 12)}-${manifest.runId}-${attempt}`;
  const object = `releases/${manifest.gitSha}/${manifest.runId}-${attempt}.zip`;
  const client = await auth.getClient();
  await client.request({
    url: `https://storage.googleapis.com/upload/storage/v1/b/${SOURCE_BUCKET}/o`, method: 'POST',
    params: { uploadType: 'media', name: object, ifGenerationMatch: '0' },
    headers: { 'Content-Type': 'application/zip' }, data: bytes, timeout: 120000, retry: false,
  });
  ledger.buildId = buildId;
  ledger.archiveSha256 = digest;
  record('SOURCE_UPLOADED', { object, archiveSha256: digest });
  const operation = await cloud(`${PARENT}/builds`, 'POST', {
    source: { archive: { userStorageUri: `gs://${SOURCE_BUCKET}/${object}`, rootDirectory: '.' } },
    labels: { 'git-sha': manifest.gitSha, 'github-run': manifest.runId, 'deployment-tool': 'luma-gated-actions' },
  }, { buildId });
  await waitOperation(operation);
  const build = await poll(() => cloud(`${PARENT}/builds/${buildId}`), value => value.state === 'READY', value => ['FAILED', 'CANCELLED', 'SKIPPED'].includes(value.state), 'Cloud build');
  assertCapacity(build);
  invariant(build.labels?.['git-sha'] === manifest.gitSha, 'Build lost commit provenance');
  record('BUILD_READY', { buildId, image: build.image, buildLogsUri: build.buildLogsUri });
  await verifyGitHub();
  invariant(singleServingBuild(await cloud(`${PARENT}/traffic`)) === previousId, 'Another deployment changed production during this build');
  ledger.status = 'PROMOTING';
  record('PROMOTION_STARTED');
  await waitOperation(await cloud(`${PARENT}/rollouts`, 'POST', { build: `${PARENT}/builds/${buildId}`, labels: { 'git-sha': manifest.gitSha } }, { rolloutId: buildId }));
  const rollout = await poll(() => cloud(`${PARENT}/rollouts/${buildId}`), value => value.state === 'SUCCEEDED', value => ['FAILED', 'CANCELLED'].includes(value.state), 'Rollout');
  invariant(buildIdFromName(rollout.build) === buildId, 'Unexpected rollout build');
  await waitServing(buildId, manifest.gitSha);
  ledger.status = 'AWAITING_BROWSER_VERIFICATION';
  record('EXPECTED_SHA_SERVING', { rollout: rollout.name });
}
async function rollbackValidate() {
  const previousId = ledger.previous?.buildId ?? singleServingBuild(await cloud(`${PARENT}/traffic`));
  buildIdFromName(`${PARENT}/builds/${previousId}`);
  const previous = await cloud(`${PARENT}/builds/${previousId}`);
  invariant(previous.state === 'READY', 'Rollback target is unavailable');
  await cloud(`${PARENT}/rollouts`, 'POST', { build: `${PARENT}/builds/${previousId}` }, { rolloutId: `validate-${manifest.runId}`, validateOnly: 'true' });
  record('ROLLBACK_REQUEST_VALIDATED_WITHOUT_CHANGING_TRAFFIC', { buildId: previousId });
}
async function recover() {
  assertDeployContext(process.env, manifest);
  const current = singleServingBuild(await cloud(`${PARENT}/traffic`));
  if (current === ledger.previous?.buildId) { record('RECOVERY_NOT_NEEDED_PRIOR_BUILD_STILL_SERVING'); return; }
  invariant(current === ledger.buildId, 'Recovery refused: another release changed traffic');
  invariant(ledger.previous?.knownGood && ledger.previous.gitSha, 'Manual recovery required: previous revision has no verified SHA provenance');
  await rollbackValidate();
  const rollbackId = `rollback-${manifest.runId}-${process.env.GITHUB_RUN_ATTEMPT}`;
  await waitOperation(await cloud(`${PARENT}/rollouts`, 'POST', { build: `${PARENT}/builds/${ledger.previous.buildId}` }, { rolloutId: rollbackId }));
  await waitServing(ledger.previous.buildId, ledger.previous.gitSha);
  ledger.status = 'ROLLED_BACK_REQUIRES_INCIDENT_REVIEW';
  record('PREVIOUS_REVISION_RESTORED');
}
try {
  const command = process.argv[2];
  if (command !== 'deploy') ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  if (command === 'deploy') await deploy();
  else if (command === 'rollback-validate') await rollbackValidate();
  else if (command === 'recover') await recover();
  else if (command === 'finalize') {
    const smoke = JSON.parse(readFileSync(resolve(out, 'smoke.json'), 'utf8'));
    invariant(smoke.status === 'PASS' && smoke.gitSha === manifest.gitSha, 'Browser evidence is missing or mismatched');
    invariant(ledger.status === 'AWAITING_BROWSER_VERIFICATION', 'Invalid release finalization state');
    await waitServing(ledger.buildId, manifest.gitSha);
    ledger.status = 'VERIFIED'; record('PRODUCTION_VERIFIED');
  } else throw new Error('Expected deploy, rollback-validate, recover, or finalize');
} catch (error) {
  ledger.status = 'FAILED';
  record('RELEASE_FAILED', { error: error.message });
  process.exitCode = 1;
}
