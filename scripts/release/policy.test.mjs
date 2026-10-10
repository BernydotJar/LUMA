import { test } from 'vitest';
import assert from 'node:assert/strict';
import { assertDeployContext, assertManifest, assertQualityJobs, buildIdFromName, REQUIRED_CHECKS, singleServingBuild } from './policy.mjs';
const manifest = { schemaVersion: 1, repository: 'BernydotJar/LUMA', gitSha: 'a'.repeat(40), gitTree: 'b'.repeat(40), commitTime: '2026-10-09T00:00:00Z', runId: '123' };
const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: manifest.repository, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: manifest.gitSha, GITHUB_RUN_ID: '123' };
test('accepts exact verified production context', () => assert.doesNotThrow(() => assertDeployContext(env, manifest)));
for (const [field, value] of Object.entries({ GITHUB_ACTIONS: 'false', GITHUB_REPOSITORY: 'attacker/LUMA', GITHUB_EVENT_NAME: 'pull_request_target', GITHUB_REF: 'refs/heads/feat/test', GITHUB_SHA: 'c'.repeat(40), GITHUB_RUN_ID: '124' })) {
  test(`rejects context mismatch: ${field}`, () => assert.throws(() => assertDeployContext({ ...env, [field]: value }, manifest)));
}
test('rejects unstamped and invalid manifests', () => {
  assert.throws(() => assertManifest({ ...manifest, gitSha: null }));
  assert.throws(() => assertManifest({ ...manifest, gitTree: '../main' }));
});
const success = REQUIRED_CHECKS.map(name => ({ name, conclusion: 'success' }));
test('requires five successful nonduplicate checks', () => {
  assert.doesNotThrow(() => assertQualityJobs(success));
  for (const name of REQUIRED_CHECKS) {
    assert.throws(() => assertQualityJobs(success.filter(job => job.name !== name)));
    for (const conclusion of ['failure', 'skipped', 'cancelled', null]) assert.throws(() => assertQualityJobs(success.map(job => job.name === name ? { ...job, conclusion } : job)));
  }
  assert.throws(() => assertQualityJobs([...success, success[0]]));
});
test('rejects cross-backend rollback', () => {
  assert.equal(buildIdFromName('projects/161313706596/locations/us-central1/backends/luma/builds/build-good'), 'build-good');
  assert.throws(() => buildIdFromName('projects/other/locations/us-central1/backends/luma/builds/build-good'));
  assert.throws(() => buildIdFromName('projects/161313706596/locations/us-central1/backends/other/builds/build-good'));
});
test('rejects split or reconciling traffic', () => {
  const split = { build: 'projects/161313706596/locations/us-central1/backends/luma/builds/build-good', percent: 100 };
  assert.equal(singleServingBuild({ current: { splits: [split] } }), 'build-good');
  assert.throws(() => singleServingBuild({ reconciling: true, current: { splits: [split] } }));
  assert.throws(() => singleServingBuild({ current: { splits: [{ ...split, percent: 50 }] } }));
});
