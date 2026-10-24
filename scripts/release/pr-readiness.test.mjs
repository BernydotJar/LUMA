import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateReleaseReadiness, evaluateProtectedSourceReadiness } from './pr-readiness.mjs';

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


test('protected-base gate rechecks live authenticated reviewer after signature verification', () => {
  const opts={digest,verify:()=>approval,
    liveReview:()=>({method:'github-human-approval',reviewer:'external-auditor',reviewId:901})};
  const accepted=evaluateProtectedSourceReadiness('/candidate',71,'b'.repeat(40),opts);
  assert.equal(accepted.status,'PASS');
  assert.ok(accepted.verified.includes('current-github-review'));
  const denied=evaluateProtectedSourceReadiness('/candidate',71,'b'.repeat(40),{
    ...opts, liveReview:()=>{throw new Error('GitHub approval dismissed');},
  });
  assert.equal(denied.status,'BLOCKED');
  assert.match(denied.reason,/dismissed/);
});

test('trusted source-attestation workflow is also triggered when a review is dismissed', () => {
  const workflow=readFileSync(resolve(import.meta.dirname,'../../.github/workflows/source-attestation.yml'),'utf8');
  assert.match(workflow,/pull_request_review:\n    types: \[submitted, edited, dismissed\]/);
  assert.match(workflow,/GH_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(workflow,/--pr "\$PR_NUMBER" --head "\$EXPECTED_PR_HEAD"/);
});
