import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { signApproval, verifyApprovalSignature, SOLO_SIGNER_ID } from './approval-signature.mjs';

const SHA = 'a'.repeat(40);
const DIGEST = 'b'.repeat(64);
const KEY = generateKeyPairSync('ed25519');
const SECRET = Buffer.from(KEY.privateKey.export({ format: 'pem', type: 'pkcs8' })).toString('base64');
const PUBLIC = Buffer.from(KEY.publicKey.export({ format: 'pem', type: 'spki' })).toString('base64');
const approval = () => ({
  schemaVersion: 3, status: 'PASS', sourceDigest: DIGEST, testedCommit: SHA,
  ciRunId: 101123, graphEventId: 'graph-event-1', graphEventHash: DIGEST,
  critic: { sha256: DIGEST }, verifier: { sha256: DIGEST },
  unresolvedCritical: 0, unresolvedHigh: 0,
  review: { method: 'protected-granite-owner-v1', reviewerType: 'automated-model-critic',
    model: 'ibm/granite3.3:2b', humanIndependent: false,
    commitSha: SHA, modelDigest: DIGEST, artifactDigestSha256: DIGEST,
    workflowRunId: 8839 },
  ownerAuthorization: { method: 'github-issue-comment', login: 'BernydotJar',
    humanIndependent: false, commitSha: SHA, commentId: 9101,
    scope: 'public-landing' },
});
const signed = () => signApproval(approval(), SECRET);
test('protected Ed25519 v3 covers actual sole maintainer model provenance', () => {
  const receipt = signed();
  assert.equal(receipt.signature.keyId, SOLO_SIGNER_ID);
  assert.equal(verifyApprovalSignature(receipt, PUBLIC), true);
});
test('v3 rejects model or owner impersonation or unsigned changes', () => {
  const r = signed();
  const broken = [
    { ...r, sourceDigest: 'c'.repeat(64) },
    { ...r, testedCommit: 'c'.repeat(40) },
    { ...r, review: { ...r.review, commitSha: 'c'.repeat(40) } },
    { ...r, review: { ...r.review, modelDigest: 'c'.repeat(64) } },
    { ...r, review: { ...r.review, workflowRunId: 8840 } },
    { ...r, review: { ...r.review, artifactDigestSha256: 'c'.repeat(64) } },
    { ...r, ownerAuthorization: { ...r.ownerAuthorization, commentId: 9102 } },
    { ...r, ownerAuthorization: { ...r.ownerAuthorization, scope: 'owner-risk-exception' } },
    { ...r, graphEventHash: 'c'.repeat(64) },
    { ...r, ciRunId: 888 },
    { ...r, signature: { ...r.signature, keyId: 'luma-independent-attestor-v2' } },
    { ...r, review: { ...r.review, humanIndependent: true } },
    { ...r, ownerAuthorization: { ...r.ownerAuthorization, login: 'fake-human' } },
  ];
  for (const item of broken) assert.throws(() => verifyApprovalSignature(item, PUBLIC));
});
test('v3 cannot be signed when owner or model evidence is missing', () => {
  for (const item of [
    { ...approval(), ownerAuthorization: null },
    { ...approval(), review: { ...approval().review, model: 'fake-human' } },
    { ...approval(), review: { ...approval().review, humanIndependent: true } },
    { ...approval(), ownerAuthorization: { ...approval().ownerAuthorization, scope: 'any' } },
    { ...approval(), unresolvedCritical: 1 },
  ]) assert.throws(() => signApproval(item, SECRET));
});
