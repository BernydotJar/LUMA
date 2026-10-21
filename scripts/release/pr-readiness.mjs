/** Source-bound PR and main release readiness. Never self-approves a review. */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { reviewedSourceDigest, verifyReview } from './review-gate.mjs';
import { verifyCurrentIndependentReview } from './live-review-check.mjs';

const root = resolve(import.meta.dirname, '../..');

/** Keep the status machine testable without mocking the GitHub/Firebase runtime. */
export function evaluateReleaseReadiness(directory = root, options = {}) {
  const calculateDigest = options.digest ?? reviewedSourceDigest;
  const verify = options.verify ?? verifyReview;
  let sourceDigest;
  try {
    sourceDigest = calculateDigest(directory);
    const approval = verify(directory);
    if (approval?.sourceDigest !== sourceDigest || approval.status !== 'PASS') {
      throw new Error('Source-bound approval does not match the checked-out release source');
    }
    return {
      status: 'PASS', sourceDigest,
      graphEventId: approval.graphEventId,
      verified: ['exact-source', 'external-ed25519-signature', 'critic-digest', 'verifier-digest', 'append-only-graph-gate'],
    };
  } catch (error) {
    return {
      status: 'BLOCKED', sourceDigest: sourceDigest ?? null,
      reason: error instanceof Error ? error.message : 'Unexpected review verification failure',
    };
  }
}

/** Protected-main workflow must revalidate review revocation with GitHub.
 * An already-signed receipt cannot silently outlive a dismissed approval. */
export function evaluateProtectedSourceReadiness(directory, prNumber, expectedHead, options = {}) {
  const local = evaluateReleaseReadiness(directory, options);
  if (local.status !== 'PASS') return local;
  try {
    const review = (options.liveReview ?? verifyCurrentIndependentReview)(directory, prNumber, expectedHead);
    if (!review || !Number.isSafeInteger(review.reviewId)) throw new Error('No current authenticated reviewer');
    return { ...local, verified: [...local.verified, 'current-github-review'],
      reviewer: { method: review.method, login: review.reviewer, reviewId: review.reviewId } };
  } catch (error) {
    return { ...local, status: 'BLOCKED',
      reason: error instanceof Error ? error.message : 'Independent GitHub approval unavailable' };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // For pull_request_target, this trusted script runs from the protected base
  // checkout while the PR merge checkout is only inert, never executed data.
  const candidateArg = process.argv.indexOf('--candidate');
  const candidate = candidateArg >= 0 ? process.argv[candidateArg + 1] : root;
  if (!candidate) throw new Error('Missing candidate source directory');
  const args = process.argv.slice(2);
  const protectedMode = candidateArg >= 0;
  if (protectedMode && (args.length !== 6 || args[0] !== '--candidate' ||
      args[2] !== '--pr' || args[4] !== '--head' || !/^\d+$/.test(args[3]))) {
    throw new Error('Expected --candidate <checkout-directory> --pr <number> --head <sha>');
  }
  const readiness = protectedMode
    ? evaluateProtectedSourceReadiness(resolve(candidate), Number(args[3]), args[5])
    : evaluateReleaseReadiness(root);
  console.log(JSON.stringify(readiness));
  if (readiness.status !== 'PASS') {
    console.error('RELEASE_READINESS_BLOCKED: independently reviewed source approval is required before merging or deploying.');
    process.exitCode = 1;
  } else {
    console.log('SOURCE_BOUND_PR_RELEASE_READINESS_PASS');
  }
}
