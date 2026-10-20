import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateReleaseReadiness } from './pr-readiness.mjs';

const sourceDigest = 'a'.repeat(64);
const approval = { status: 'PASS', sourceDigest, graphEventId: 'verified-graph-event' };
const digest = () => sourceDigest;

test('PR gate accepts exact-source approval only after the independent verifier returns PASS', () => {
  const result = evaluateReleaseReadiness('/repo', { digest, verify: () => approval });
  assert.equal(result.status, 'PASS');
  assert.equal(result.sourceDigest, sourceDigest);
  assert.equal(result.graphEventId, approval.graphEventId);
});

test('PR gate fails closed when an approval is missing, blocked, or stale', () => {
  for (const value of [null, { ...approval, status: 'BLOCKED' }, { ...approval, sourceDigest: 'b'.repeat(64) }]) {
    const result = evaluateReleaseReadiness('/repo', { digest, verify: () => value });
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.sourceDigest, sourceDigest);
  }
});

test('PR gate does not hide Graph hash-chain or evidence verification failures', () => {
  for (const reason of ['Graph hash mismatch', 'critic evidence changed after approval', 'Release gate is missing, stale or blocked']) {
    const result = evaluateReleaseReadiness('/repo', { digest, verify: () => { throw new Error(reason); } });
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.reason, reason);
  }
});

test('PR gate rejects missing and untrustworthy source trees', () => {
  const result = evaluateReleaseReadiness('/repo', { digest: () => { throw new Error('Non-regular release input'); }, verify: () => approval });
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.sourceDigest, null);
});

test('review approval with a stale current digest cannot pass', () => {
  const result = evaluateReleaseReadiness('/candidate', {
    digest: () => 'f'.repeat(64), verify: () => approval,
  });
  assert.equal(result.status, 'BLOCKED');
  assert.match(result.reason, /does not match/);
});


test('trusted check evaluates untrusted PR only as data with read-only permissions', () => {
  const workflow = readFileSync(resolve(import.meta.dirname, '../../.github/workflows/source-attestation.yml'), 'utf8');
  assert.match(workflow, /pull_request_target:/);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(workflow, /ref: refs\/pull\/\$\{\{ github\.event\.pull_request\.number \}\}\/merge/);
  assert.match(workflow, /node protected-policy\/scripts\/release\/pr-readiness\.mjs --candidate/);
  assert.doesNotMatch(workflow, /run:\s*npm (ci|install)|id-token:\s*write|run:\s*node candidate-data\//);
});
