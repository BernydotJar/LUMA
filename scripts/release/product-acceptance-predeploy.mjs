/** Only a protected push-to-main pipeline can request public landing promotion.
 * This is a scoped product predeploy contract check, not a substitute for UAT.
 * The signed Graph release receipt and authenticated CI checks remain mandatory.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyReview } from './review-gate.mjs';
import { invariant } from './policy.mjs';

export function assertScopedProductPredeploy(approval, env) {
  invariant(env.GITHUB_ACTIONS === 'true' &&
    env.GITHUB_REPOSITORY === 'BernydotJar/LUMA' &&
    env.GITHUB_EVENT_NAME === 'push' && env.GITHUB_REF === 'refs/heads/main',
    'Predeploy acceptance must run on protected main push');
  invariant(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? ''),
    'Expected verified main commit');
  invariant(approval?.status === 'PASS', 'Predeploy requires signed PASS');
  // Preserve the legacy external-review route: verifyReview() has already
  // validated its real Ed25519 signature, Graph and evidence chain.
  if (approval.schemaVersion === 2) {
    invariant(['github-codex-clean-review','github-human-approval'].includes(
      approval.review?.method) && Number.isSafeInteger(approval.review?.reviewId),
      'Legacy v2 must have a real external independent review');
    return { status:'LEGACY_EXTERNAL_REVIEW_PREDEPLOY_PASS',
      reviewedSourceSha:approval.testedCommit,publishedSourceSha:env.GITHUB_SHA };
  }
  invariant(approval.schemaVersion === 3,
    'Solo-maintainer predeploy needs the signed v3 acceptance receipt');
  invariant(approval.ownerAuthorization?.scope === 'public-landing' &&
    approval.ownerAuthorization?.humanIndependent === false &&
    approval.review?.method === 'protected-granite-owner-v1',
    'Only public landing scope is eligible for automated-model release');
  invariant(approval.review?.commitSha === approval.testedCommit &&
    approval.ownerAuthorization?.commitSha === approval.testedCommit,
    'Predeploy owner and model evidence must match the reviewed exact SHA');
  return { status: 'SCOPED_PRODUCT_PREDEPLOY_PASS', scope: 'public-landing',
    reviewedSourceSha: approval.testedCommit, publishedSourceSha: env.GITHUB_SHA };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // End-to-end prior verification including Ed25519/Graph is intentional.
  const approval = verifyReview();
  console.log(JSON.stringify(assertScopedProductPredeploy(approval, process.env)));
}
