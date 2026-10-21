/** Independent Ed25519 release attestation. The trusted public key comes from
 * repository administration, never from candidate files or pull request data. */
import { createPublicKey, createPrivateKey, sign, verify } from 'node:crypto';
import { invariant } from './policy.mjs';

export const RELEASE_SIGNER_ID = 'luma-independent-attestor-v2';
const SHA256 = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const DETAILED_KEYS = ['schemaVersion','status','sourceDigest','testedCommit','ciRunId',
  'graphEventId','graphEventHash','criticSha256','verifierSha256',
  'reviewMethod','reviewer','reviewId','reviewCommit'];

/** Fixed-order, length-delimited values to avoid ambiguous JSON serialization. */
export function approvalSigningBytes(approval) {
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

function readTrustedPublicKey(base64) {
  invariant(typeof base64 === 'string' && base64.length >= 100, 'Trusted CI attestation public key not configured');
  const pem = Buffer.from(base64, 'base64').toString('utf8');
  const key = createPublicKey(pem);
  invariant(key.asymmetricKeyType === 'ed25519', 'Trusted attestation public key must use Ed25519');
  return key;
}

export function verifyApprovalSignature(approval, trustedPublicKeyBase64) {
  const signature = approval?.signature;
  invariant(signature?.algorithm === 'Ed25519' && signature.keyId === RELEASE_SIGNER_ID &&
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
  return { ...approval, signature: { algorithm:'Ed25519', keyId:RELEASE_SIGNER_ID,
    value:sign(null,approvalSigningBytes(approval),key).toString('base64') } };
}
