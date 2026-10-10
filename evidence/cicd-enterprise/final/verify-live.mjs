import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read-only independent verification. No deployment, IAM or traffic writes.
const root = resolve(import.meta.dirname, '../../..');
const expected = process.argv[2];
const runId = process.argv[3];
assert.match(expected ?? '', /^[a-f0-9]{40}$/);
assert.match(runId ?? '', /^\d+$/);
const project = 'luma-learning-intelligence';
const parent = `projects/${project}/locations/us-central1/backends/luma`;
const url = 'https://luma--luma-learning-intelligence.us-central1.hosted.app';
const cli = '/usr/local/lib/node_modules/firebase-tools/lib/';
const report = { observedAt: new Date().toISOString(), status: 'STARTED', expectedGitSha: expected, workflowRunId: runId };
const github = path => JSON.parse(execFileSync('gh', ['api', `repos/BernydotJar/LUMA/${path}`], { encoding: 'utf8' }));
try {
  const run = github(`actions/runs/${runId}`);
  assert.equal(run.head_sha, expected);
  assert.equal(run.event, 'push');
  assert.equal(run.head_branch, 'main');
  assert.equal(run.conclusion, 'success');
  const jobs = github(`actions/runs/${runId}/jobs?filter=latest&per_page=100`).jobs;
  for (const name of ['verify', 'security', 'firestore', 'identity-roles', 'browser', 'deploy']) {
    const selected = jobs.filter(job => job.name === name);
    assert.equal(selected.length, 1); assert.equal(selected[0].conclusion, 'success');
  }
  const protection = github('branches/main/protection');
  assert.equal(protection.enforce_admins.enabled, true);
  assert.equal(protection.required_status_checks.strict, true);
  assert.equal(protection.allow_force_pushes.enabled, false);
  assert.equal(protection.allow_deletions.enabled, false);
  assert.ok(protection.required_pull_request_reviews);
  for (const name of ['verify', 'security', 'firestore', 'identity-roles', 'browser']) assert.ok(protection.required_status_checks.checks.some(check => check.context === name && check.app_id === 15368));
  const release = JSON.parse(readFileSync(resolve(root, 'evidence/cicd-enterprise/production/release-result.json'), 'utf8'));
  const smoke = JSON.parse(readFileSync(resolve(root, 'evidence/cicd-enterprise/production/smoke.json'), 'utf8'));
  assert.equal(release.status, 'VERIFIED'); assert.equal(release.gitSha, expected);
  assert.equal(smoke.status, 'PASS'); assert.equal(smoke.gitSha, expected); assert.equal(smoke.errors.length, 0);
  await (await import(cli + 'requireAuth.js')).default.requireAuth({ project, nonInteractive: true });
  const { Client } = (await import(cli + 'apiv2.js')).default;
  const api = new Client({ urlPrefix: 'https://firebaseapphosting.googleapis.com', apiVersion: 'v1beta', auth: true });
  const get = async path => (await api.get(path)).body;
  const backend = await get(parent);
  const traffic = await get(parent + '/traffic');
  assert.equal(backend.uri, new URL(url).host);
  assert.ok(!backend.codebase?.repository);
  assert.ok(!traffic.reconciling);
  assert.equal(traffic.current.splits.length, 1);
  assert.equal(traffic.current.splits[0].percent, 100);
  const build = await get(traffic.current.splits[0].build);
  assert.equal(build.name.split('/').at(-1), release.buildId);
  assert.equal(build.state, 'READY'); assert.equal(build.labels['git-sha'], expected);
  const rollout = await get(`${parent}/rollouts/${release.buildId}`);
  assert.equal(rollout.state, 'SUCCEEDED');
  assert.equal(rollout.build.split('/').at(-1), release.buildId);
  const capacity = build.config.runConfig;
  assert.equal(capacity.cpu, 1); assert.equal(capacity.memoryMib, 512);
  assert.equal(capacity.maxInstances, 2); assert.equal(capacity.minInstances ?? 0, 0); assert.equal(capacity.concurrency, 80);
  const versionResponse = await fetch(`${url}/api/version?verification=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
  assert.equal(versionResponse.status, 200);
  const version = await versionResponse.json(); assert.equal(version.gitSha, expected);
  const health = await fetch(url + '/api/health', { signal: AbortSignal.timeout(30000) });
  assert.equal(health.status, 200);
  report.status = 'VERIFIED';
  report.github = { url: run.html_url, mainProtected: true, requiredChecks: protection.required_status_checks.checks, administratorBypass: false, humanApprovalCount: protection.required_pull_request_reviews.required_approving_review_count, jobs: jobs.map(job => ({ name: job.name, conclusion: job.conclusion, url: job.html_url })) };
  report.firebase = { backend: backend.name, url, build: build.name, rollout: rollout.name, rolloutState: rollout.state, servingPercent: 100, version, capacity, healthStatus: health.status };
  report.smoke = { status: smoke.status, routes: smoke.routes, checks: smoke.checks, errors: smoke.errors };
  report.rollback = { previous: release.previous, requestValidated: release.events.some(event => event.phase === 'ROLLBACK_REQUEST_VALIDATED_WITHOUT_CHANGING_TRAFFIC'), destructiveDrillPerformed: false };
  console.log(JSON.stringify({ status: report.status, gitSha: expected, build: build.name, rollout: rollout.name, smoke: smoke.status, routes: smoke.routes.length }, null, 2));
} catch (error) {
  report.status = 'FAILED'; report.error = error.message; process.exitCode = 1;
  console.error(error.message);
} finally {
  writeFileSync(resolve(import.meta.dirname, 'independent-production-verification.json'), JSON.stringify(report, null, 2) + '\n');
}
