import { test } from 'vitest';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const script = resolve(import.meta.dirname, 'apphosting.mjs');
const sha = 'a'.repeat(40);

test('failed preflight never contacts Google Cloud or falsely rolls back traffic', () => {
  const directory = mkdtempSync(join(tmpdir(), 'luma-no-promotion-'));
  try {
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({
      schemaVersion: 1, repository: 'BernydotJar/LUMA', gitSha: sha,
      gitTree: 'b'.repeat(40), commitTime: '2026-10-13T00:00:00Z', runId: '123',
    }));
    writeFileSync(join(directory, 'release-result.json'), JSON.stringify({
      schemaVersion: 1, gitSha: sha, runId: '123', project: 'luma-learning-intelligence',
      backend: 'luma', status: 'FAILED',
      events: [{ phase: 'RELEASE_FAILED', at: '2026-10-13T00:00:00Z', error: 'Source changed since independent review' }],
    }));
    const run = spawnSync(process.execPath, [script, 'recover'], {
      env: { ...process.env, RELEASE_DIR: directory, GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'BernydotJar/LUMA', GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha, GITHUB_RUN_ID: '123',
        // No GCP access tokens are supplied. A cloud request would fail.
        GOOGLE_APPLICATION_CREDENTIALS: join(directory, 'does-not-exist.json'),
      }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /RECOVERY_NOT_REQUIRED_NO_PROMOTION/);
    const after = JSON.parse(readFileSync(join(directory, 'release-result.json'), 'utf8'));
    assert.equal(after.status, 'FAILED');
    assert.equal(after.events.at(-1)?.phase, 'RECOVERY_NOT_REQUIRED_NO_PROMOTION');
    assert.equal(after.events.some(e => e.phase === 'PREVIOUS_REVISION_RESTORED'), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
