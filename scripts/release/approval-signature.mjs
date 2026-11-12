/** Independent Ed25519 release attestation. The trusted public key comes from
 * repository administration, never from candidate files or pull request data. */
import { createPublicKey, createPrivateKey, sign, verify } from 'node:crypto';
import { invariant } from './policy.mjs';

export const RELEASE_SIGNER_ID = 'luma-independent-attestor-v2';
export const SOLO_SIGNER_ID = 'luma-solo-maintainer-attestor-v3';
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const DETAILED_KEYS = ['schemaVersion','status','sourceDigest','testedCommit','ciRunId',
  'graphEventId','graphEventHash','criticSha256','verifierSha256',
  'reviewMethod','reviewer','reviewId','reviewCommit'];

/** Fixed-order, length-delimited values to avoid ambiguous JSON serialization. */
export function approvalSigningBytes(approval) {
  if (approval?.schemaVersion === 3) return soloApprovalSigningBytes(approval);
  invariant(approval?.schemaVersion === 2 && approval.status === 'PASS', 'Unsigned release approval is invalid');
  invariant(SHA256.test(approval.sourceDigest) && COMMIT.test(approval.testedCommit), 'Signature requires exact source/commit');
  invariant(/^\d+$/.test(String(approval.ciRunId ?? '')) && Number(approval.ciRunId) > 0, 'Signature requires a concrete successful QA run');
  invariant(approval.graphEventId && SHA256.test(approval.graphEventHash), 'Signature requires the Graph receipt');
  invariant(SHA256.test(approval.critic?.sha256) && SHA256.test(approval.verifier?.sha256), 'Signature requires critic and verifier receipts');
  const review = approval.review;
  invariant(['github-codex-clean-review','github-human-approval'].includes(review?.method) &&
    typeof review.reviewer === 'string' && review.reviewer.length > 0 &&
    Number.isSafeInteger(review.reviewId) && review.reviewId > 0 &&
    review.commitSha === approval.testedCommit,
    'Signature requires exact-SHA authenticated external reviewer provenance');
  const values = [2,'PASS',approval.sourceDigest,approval.testedCommit,String(approval.ciRunId),
    approval.graphEventId,approval.graphEventHash,approval.critic.sha256,approval.verifier.sha256,
    review.method,review.reviewer,String(review.reviewId),review.commitSha];
  return Buffer.from('LUMA\0SOURCE-RELEASE-ATTESTATION\0v2\0'+
    DETAILED_KEYS.map((key,index)=>`${key}:${Buffer.byteLength(String(values[index]))}:${values[index]}`).join('\n')+'\n');
}

/** V3 is a distinct, type-tagged release decision, not an impersonated human review.
 * Every signed byte is canonical and every new provenance ID participates in Ed25519.
 * GitHub-authenticated run/comment/artifact validation happens in the protected signer;
 * structurally valid bytes alone never grant release permission.
 */
export function soloApprovalSigningBytes(approval) {
  invariant(approval?.schemaVersion === 3 && approval.status === 'PASS',
    'Solo-maintainer approval requires v3 PASS');
  invariant(SHA256.test(approval.sourceDigest ?? '') && COMMIT.test(approval.testedCommit ?? ''),
    'Solo approval requires exact source/commit');
  invariant(Number.isSafeInteger(Number(approval.ciRunId)) && Number(approval.ciRunId) > 0,
    'Solo approval requires actual CI run');
  invariant(typeof approval.graphEventId === 'string' && approval.graphEventId.length > 0 &&
    SHA256.test(approval.graphEventHash ?? '') && SHA256.test(approval.critic?.sha256 ?? '') &&
    SHA256.test(approval.verifier?.sha256 ?? '') && SHA256.test(approval.ci?.sha256 ?? '') && approval.unresolvedCritical === 0 &&
    approval.unresolvedHigh === 0, 'Solo approval requires Graph/critic/verifier evidence');
  const review = approval.review;
  invariant(review?.method === 'protected-granite-owner-v1' &&
    review.reviewerType === 'automated-model-critic' &&
    review.model === 'ibm/granite3.3:2b' &&
    review.humanIndependent === false &&
    review.commitSha === approval.testedCommit &&
    ['PASS','NEEDS_REVIEW'].includes(review.modelVerdict) &&
    Number.isSafeInteger(review.codexReviewCommentId) &&
    (review.modelVerdict === 'PASS' ? review.codexReviewCommentId === 0 : review.codexReviewCommentId > 0) &&
    COMMIT.test(review.trustedWorkflowCommit ?? '') &&
    SHA256.test(review.modelDigest ?? '') && SHA256.test(review.artifactDigestSha256 ?? '') &&
    Number.isSafeInteger(review.workflowRunId) && review.workflowRunId > 0,
    'Solo approval requires a protected model review on the exact commit');
  const owner = approval.ownerAuthorization;
  invariant(owner?.method === 'github-issue-comment' &&
    owner.login === 'BernydotJar' &&
    Number.isSafeInteger(owner.commentId) && owner.commentId > 0 &&
    owner.commitSha === approval.testedCommit &&
    ['public-landing','owner-risk-exception'].includes(owner.scope) &&
    owner.humanIndependent === false,
    'Solo approval requires identified owner authorization for the exact commit');
  const fields = [
    ['schemaVersion','3'], ['status','PASS'],
    ['sourceDigest',approval.sourceDigest], ['testedCommit',approval.testedCommit],
    ['ciRunId',String(approval.ciRunId)], ['graphEventId',approval.graphEventId],
    ['graphEventHash',approval.graphEventHash], ['criticSha256',approval.critic.sha256],
    ['verifierSha256',approval.verifier.sha256], ['ciSha256',approval.ci.sha256],
    ['unresolvedCritical','0'], ['unresolvedHigh','0'],
    ['reviewMethod',review.method], ['reviewerType',review.reviewerType],
    ['reviewModel',review.model], ['modelVerdict',review.modelVerdict],
    ['codexReviewCommentId',String(review.codexReviewCommentId)],
    ['modelDigest',review.modelDigest],
    ['reviewCommitSha',review.commitSha], ['reviewWorkflowRunId',String(review.workflowRunId)],
    ['trustedWorkflowCommit',review.trustedWorkflowCommit],
    ['reviewArtifactSha256',review.artifactDigestSha256], ['humanIndependent','false'],
    ['ownerMethod',owner.method], ['ownerLogin',owner.login],
    ['ownerCommentId',String(owner.commentId)], ['ownerCommitSha',owner.commitSha],
    ['ownerScope',owner.scope], ['ownerHumanIndependent','false'],
  ];
  return Buffer.from('LUMA\0SOURCE-RELEASE-ATTESTATION\0v3\0' +
    fields.map(([key,value]) => `${key}:${Buffer.byteLength(value)}:${value}`).join('\n') + '\n');
}

function readTrustedPublicKey(base64) {
  invariant(typeof base64 === 'string' && base64.length >= 100, 'Trusted CI attestation public key not configured');
  const pem = Buffer.from(base64, 'base64').toString('utf8');
  const key = createPublicKey(pem);
  invariant(key.asymmetricKeyType === 'ed25519', 'Trusted attestation public key must use Ed25519');
  return key;
}

export function verifyApprovalSignature(approval, trustedPublicKeyBase64) {
  const signature = approval?.signature;
  invariant(signature?.algorithm === 'Ed25519' &&
    signature.keyId === (approval?.schemaVersion === 3 ? SOLO_SIGNER_ID : RELEASE_SIGNER_ID) &&
    typeof signature.value === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(signature.value),
    'Missing or malformed independent CI signature');
  const key = readTrustedPublicKey(trustedPublicKeyBase64);
  invariant(verify(null, approvalSigningBytes(approval), key, Buffer.from(signature.value,'base64')),
    'Independent release signature is not valid for this source digest and Graph receipt');
  return true;
}

/** Only a protected-main, authorized signer workflow may call this function. */
export function signApproval(approval, privateKeyBase64) {
  invariant(typeof privateKeyBase64 === 'string' && privateKeyBase64.length > 100,
    'Protected signing key is unavailable');
  const key = createPrivateKey(Buffer.from(privateKeyBase64,'base64').toString('utf8'));
  invariant(key.asymmetricKeyType === 'ed25519', 'Signing key must be Ed25519');
  return { ...approval, signature: { algorithm:'Ed25519',
    keyId: approval?.schemaVersion === 3 ? SOLO_SIGNER_ID : RELEASE_SIGNER_ID,
    value:sign(null,approvalSigningBytes(approval),key).toString('base64') } };
}
