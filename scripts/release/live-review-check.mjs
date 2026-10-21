/** Protected-base admission control: a signed historical approval is valid
 * only while its exact GitHub reviewer decision remains in force. Do not run
 * candidate-owned policy or trust an actor claim from Graph/PR JSON. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { invariant } from './policy.mjs';
import { ghPages, authenticateIndependentSourceReview } from './trusted-attestor.mjs';

const REPO = 'BernydotJar/LUMA';
const SHA = /^[a-f0-9]{40}$/;
function gh(path) {
  return JSON.parse(execFileSync('gh', ['api', path],
    { encoding:'utf8', timeout:20000, maxBuffer:8*1024*1024 }));
}

/** A signed approval may be imported via ONE strictly receipt-only commit.
 * Never treat an arbitrary descendant, a docs/catalog change, or a new source
 * tree as an already reviewed and approved SHA. `compare` comes from GitHub's
 * authenticated REST API, not candidate source or Graph/PR JSON.
 */
export function assertReceiptOnlyHeadAdvance(reviewedHead, currentHead, compare) {
  invariant(SHA.test(reviewedHead ?? '') && SHA.test(currentHead ?? ''),
    'Receipt-only head policy requires full source commit SHAs');
  if (reviewedHead === currentHead) return 'EXACT_REVIEWED_HEAD';
  const changed = compare?.files;
  const later = compare?.commits;
  invariant(compare?.status === 'ahead' && compare.ahead_by === 1 &&
    compare.behind_by === 0 && compare.base_commit?.sha === reviewedHead &&
    Array.isArray(later) && later.length === 1 &&
    later[0]?.sha === currentHead &&
    later[0]?.parents?.length === 1 && later[0].parents[0].sha === reviewedHead &&
    Array.isArray(changed) && changed.length === 1 &&
    changed[0]?.filename === 'evidence/cicd-enterprise/release-approval.json' &&
    changed[0]?.status === 'modified',
    'Unreviewed source or non-receipt changes after signed approval');
  return 'SINGLE_SIGNED_RECEIPT_IMPORT';
}

/** Pure verification against already authenticated GitHub API responses. */
export function assertCurrentIndependentReview(approval, pr, expectedHead,
    comments, reviews, commits, reviewerAllowlist, authenticatedCompare = null) {
  invariant(approval?.schemaVersion === 2 && approval.status === 'PASS' &&
    SHA.test(approval.review?.commitSha ?? '') &&
    approval.review.commitSha === approval.testedCommit,
    'Historical release receipt lacks a source-bound independent reviewer');
  invariant(SHA.test(expectedHead ?? '') && pr?.head?.sha === expectedHead &&
    pr.head.repo?.full_name === REPO && pr.base?.ref === 'main' &&
    pr.state === 'open' && !pr.merged,
    'PR source, base, or current head changed after protected review event');
  invariant(commits.some(commit => commit.sha === approval.review.commitSha),
    'Signed reviewed SHA is no longer in the PR commit history');
  // The signer reviews C0. Importing only its signed receipt as C1 may change
  // the Git commit ID, but no executable or business acceptance content.
  // Require the GitHub-authenticated C0..C1 delta before reusing that review.
  assertReceiptOnlyHeadAdvance(approval.review.commitSha, expectedHead,
    authenticatedCompare);
  const contributors = commits.flatMap(commit =>
    [commit.author?.login, commit.committer?.login].filter(Boolean));
  const current = authenticateIndependentSourceReview(comments, reviews,
    approval.review.commitSha, pr.user?.login, reviewerAllowlist, contributors);
  invariant(current.method === approval.review.method &&
    current.reviewer === approval.review.reviewer &&
    current.reviewId === approval.review.reviewId,
    'Signed reviewer approval was revoked, superseded or replaced');
  return current;
}

export function verifyCurrentIndependentReview(directory, prNumber, expectedHead) {
  invariant(Number.isSafeInteger(prNumber) && prNumber > 0 && SHA.test(expectedHead ?? ''),
    'Protected review check requires a real PR number and webhook SHA');
  const approval = JSON.parse(readFileSync(resolve(directory,
    'evidence/cicd-enterprise/release-approval.json'), 'utf8'));
  const pr = gh(`repos/${REPO}/pulls/${prNumber}`);
  const comments = ghPages(`repos/${REPO}/issues/${prNumber}/comments?per_page=100`);
  const reviews = ghPages(`repos/${REPO}/pulls/${prNumber}/reviews?per_page=100`);
  const commits = ghPages(`repos/${REPO}/pulls/${prNumber}/commits?per_page=100`);
  invariant(SHA.test(approval?.review?.commitSha ?? ''),
    'Protected source check requires a valid signed reviewed commit');
  const compare = approval.review.commitSha === expectedHead ? null :
    gh(`repos/${REPO}/compare/${approval.review.commitSha}...${expectedHead}`);
  return assertCurrentIndependentReview(approval, pr, expectedHead,
    comments, reviews, commits, process.env.LUMA_RELEASE_TRUSTED_REVIEWERS, compare);
}
