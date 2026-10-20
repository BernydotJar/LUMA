/** Runs ONLY from a protected-main workflow_dispatch with a main-only environment.
 * It reads PR files as inert data and checks GitHub's independent reviewer identity.
 * No candidate JS, shell, npm scripts or approval self-claims are executed. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { reviewedSourceDigest, verifyReview } from './review-gate.mjs';
import { signApproval, verifyApprovalSignature } from './approval-signature.mjs';
import { invariant } from './policy.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const REPO = 'BernydotJar/LUMA';
const REQUIRED = ['verify','security','firestore','identity-roles','browser',
  'coach-rbac','institution-intake','institution-browser','institution-approval'];
function gh(path) {
  return JSON.parse(execFileSync('gh', ['api',path], { encoding:'utf8',timeout:20000,maxBuffer:8*1024*1024 }));
}
export function ghPages(path) {
  // GitHub CLI versions that do not implement `--slurp` still expose a stable
  // JSON array for each explicit page. Never silently truncate review history.
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const suffix = path.includes('?') ? '&' : '?';
    const rows = gh(`${path}${suffix}page=${page}`);
    invariant(Array.isArray(rows), 'GitHub review pagination returned a non-array response');
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw new Error('GitHub reviewer history exceeds safe pagination limit');
}
const git = (directory,...args) => execFileSync('git',args,{cwd:directory,encoding:'utf8',timeout:15000}).trim();
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');

export function authenticateExternalCodexReview(comments,sourceCommit) {
  const verified = comments.filter(comment =>
    comment.user?.login === 'chatgpt-codex-connector[bot]' &&
    comment.body?.includes('<!-- codex-review-state:v1 '));
  const current = verified.flatMap(comment => {
    try {
      const match = comment.body.match(/<!-- codex-review-state:v1 (\{[^\n]*\}) -->/);
      if (!match) return [];
      const receipt = JSON.parse(match[1]);
      return receipt.code_review?.commit_sha === sourceCommit ? [
        { ...receipt.code_review, publishedAt: comment.updated_at ?? comment.created_at ?? '' },
      ] : [];
    } catch { return []; }
  }).sort((a,b) => a.publishedAt.localeCompare(b.publishedAt));
  const latest = current.at(-1);
  invariant(latest?.status === 'completed' && latest.has_any_findings === false &&
    latest.has_unresolved_findings === false,
    'Latest independent Codex review for exact source commit is missing or has findings');
  return true;
}

/** Alternate independent reviewer when the GitHub Codex integration is rate-limited.
 * Only GitHub's authenticated review API and an administrator-maintained
 * allowlist can authorize this path. Candidate-authored approval JSON cannot.
 */
export function authenticateTrustedHumanReview(reviews, sourceCommit, prAuthor, reviewerAllowlist,
    candidateContributors = []) {
  invariant(/^[a-f0-9]{40}$/.test(sourceCommit), 'Human approval requires exact full source SHA');
  invariant(typeof prAuthor === 'string' && prAuthor.length > 0, 'PR author must be known');
  const trusted = new Set(String(reviewerAllowlist ?? '').split(/[\n,]/)
    .map(login => login.trim().toLowerCase())
    .filter(login => /^[a-z0-9](?:[a-z0-9-]{0,37})$/.test(login)));
  invariant(trusted.size > 0, 'No independently authorized reviewer logins configured');
  const contributors = new Set([prAuthor, ...candidateContributors]
    .filter(value => typeof value === 'string').map(value => value.toLowerCase()));
  const reviewers = new Map();
  for (const review of reviews) {
    const login = review.user?.login?.toLowerCase();
    if (!login || contributors.has(login) || !trusted.has(login) ||
      review.user?.type !== 'User' || !Number.isSafeInteger(review.id) || review.id <= 0 ||
      !['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(review.state)) continue;
    const existing = reviewers.get(login);
    const stamp = typeof review.submitted_at === 'string' ? review.submitted_at : '';
    if (!existing || stamp > existing.stamp || stamp === existing.stamp && review.id > existing.id) {
      reviewers.set(login, { ...review, stamp });
    }
  }
  // A second allowlisted reviewer requesting changes at this SHA must veto
  // an approval from another person until the concern is addressed.
  invariant(![...reviewers.values()].some(review =>
    review.state === 'CHANGES_REQUESTED' && review.commit_id === sourceCommit),
    'An independent authorized reviewer has outstanding requested changes');
  const approved = [...reviewers.values()].find(review =>
    review.state === 'APPROVED' && review.commit_id === sourceCommit &&
    Boolean(review.submitted_at));
  invariant(approved, 'An allowlisted independent human must approve the exact source SHA in GitHub');
  return { method: 'github-human-approval', reviewer: approved.user.login, reviewId: approved.id };
}

/** A completed Codex review with findings is a hard stop, never a human override.
 * If Codex fails due to quota/unavailability, a trusted external reviewer can
 * supply an actual GitHub APPROVED review on the final source commit instead.
 */
export function authenticateIndependentSourceReview(comments, reviews, sourceCommit, prAuthor,
    reviewerAllowlist, candidateContributors = []) {
  // Even a clean Codex result must not override outstanding change requests
  // from an independently authorized human on the same exact source SHA.
  const trusted = new Set(String(reviewerAllowlist ?? '').split(/[\n,]/)
    .map(login => login.trim().toLowerCase()).filter(Boolean));
  const contributors = new Set([prAuthor, ...candidateContributors]
    .filter(Boolean).map(value => value.toLowerCase()));
  const decisive = new Map();
  for (const review of reviews) {
    const login = review.user?.login?.toLowerCase();
    if (!trusted.has(login) || contributors.has(login) || review.user?.type !== 'User' ||
        review.commit_id !== sourceCommit ||
        !['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(review.state)) continue;
    const previous = decisive.get(login);
    const at = review.submitted_at ?? '';
    if (!previous || at > previous.at || at === previous.at && review.id > previous.id) {
      decisive.set(login, { state: review.state, at, id: review.id });
    }
  }
  invariant(![...decisive.values()].some(review => review.state === 'CHANGES_REQUESTED'),
    'Independent human requested changes on reviewed source SHA; Codex cannot override');
  const latest = comments.filter(comment => comment.user?.login === 'chatgpt-codex-connector[bot]')
    .flatMap(comment => {
      const match = comment.body?.match(/<!-- codex-review-state:v1 (\{[^\n]*\}) -->/);
      if (!match) return [];
      try {
        const state = JSON.parse(match[1]).code_review;
        return state?.commit_sha === sourceCommit
          ? [{ ...state, postedAt: comment.updated_at ?? comment.created_at ?? '',
              reviewId: comment.id }] : [];
      } catch { return []; }
    }).sort((a, b) => a.postedAt.localeCompare(b.postedAt)).at(-1);
  if (latest?.status === 'completed') {
    invariant(latest.has_any_findings === false && latest.has_unresolved_findings === false,
      'Completed independent Codex review has unresolved or undisposed findings');
    invariant(Number.isSafeInteger(latest.reviewId) && latest.reviewId > 0,
      'GitHub Codex receipt is missing its authenticated issue-comment ID');
    return { method: 'github-codex-clean-review', reviewer: 'chatgpt-codex-connector[bot]',
      reviewId: latest.reviewId };
  }
  invariant(!latest || latest.status === 'failed',
    'Independent Codex review is still running; wait for a final result');
  return authenticateTrustedHumanReview(reviews, sourceCommit, prAuthor, reviewerAllowlist,
    candidateContributors);
}

/** Never sign a newer PR head using an ancestor's CI or review. */
export function requireExactReviewedHead(testedCommit, candidateHead, prHead) {
  invariant(/^[a-f0-9]{40}$/.test(testedCommit) && /^[a-f0-9]{40}$/.test(candidateHead) &&
    testedCommit === candidateHead && candidateHead === prHead,
    'Independent approval requires exact matching PR HEAD, tested commit and reviewed source');
  return true;
}

export function validateQualityRun(run,jobs,commit,registeredWorkflowId) {
  invariant(Number.isSafeInteger(registeredWorkflowId) && registeredWorkflowId > 0 &&
    run.workflow_id === registeredWorkflowId && run.path === '.github/workflows/quality.yml' &&
    run.repository?.full_name === REPO && run.head_repository?.full_name === REPO &&
    run.head_sha === commit && run.event === 'pull_request' &&
    ['failure','success'].includes(run.conclusion),
    'CI must use the registered Product quality workflow on the exact reviewed PR HEAD');
  for (const name of REQUIRED) {
    const found = jobs.filter(job => job.name === name);
    invariant(found.length === 1 && found[0].conclusion === 'success', `Quality job not approved: ${name}`);
  }
  invariant(jobs.filter(job => job.name === 'release-readiness').length === 1 &&
    jobs.filter(job => job.name === 'deploy').length === 1,
    'Release-readiness and deploy job receipts are required');
  for (const job of jobs) {
    if (REQUIRED.includes(job.name)) continue;
    invariant(job.name === 'release-readiness' && ['failure','success'].includes(job.conclusion) ||
      job.name === 'deploy' && job.conclusion === 'skipped', 'Unexpected failing or unverified CI job');
  }
  return true;
}

async function main() {
  invariant(process.env.GITHUB_REF === 'refs/heads/main' && process.env.GITHUB_REPOSITORY === REPO,
    'Trusted attestation must run on protected main');
  const [candidate,prArg] = process.argv.slice(2);
  invariant(candidate && /^\d+$/.test(prArg ?? '') && Number(prArg) > 0, 'Candidate directory and PR number required');
  const directory=resolve(candidate);
  const approvalPath=resolve(directory,'evidence/cicd-enterprise/release-approval.json');
  const approval=JSON.parse(readFileSync(approvalPath,'utf8'));
  invariant(!approval.signature, 'Candidate must not supply a pre-signed approval');
  const head=git(directory,'rev-parse','HEAD');
  invariant(/^[a-f0-9]{40}$/.test(head) && /^[a-f0-9]{40}$/.test(approval.testedCommit),
    'Missing verified source commit');
  const pr=gh(`repos/${REPO}/pulls/${prArg}`);
  requireExactReviewedHead(approval.testedCommit,head,pr.head.sha);
  invariant(pr.base.ref === 'main' && pr.state === 'open' && pr.merged === false,
    'PR changed since checkout or no longer open');
  const source=reviewedSourceDigest(directory);
  invariant(source === approval.sourceDigest,'Source digest differs from independently reviewed code');
  const run=gh(`repos/${REPO}/actions/runs/${approval.ciRunId}`);
  const jobs=gh(`repos/${REPO}/actions/runs/${approval.ciRunId}/jobs?filter=latest&per_page=100`).jobs;
  const workflow=gh(`repos/${REPO}/actions/workflows/quality.yml`);
  validateQualityRun(run,jobs,approval.testedCommit,workflow.id);
  const comments=ghPages(`repos/${REPO}/issues/${prArg}/comments?per_page=100`);
  const reviews=ghPages(`repos/${REPO}/pulls/${prArg}/reviews?per_page=100`);
  const commits=ghPages(`repos/${REPO}/pulls/${prArg}/commits?per_page=100`);
  const contributors=commits.flatMap(commit =>
    [commit.author?.login,commit.committer?.login].filter(Boolean));
  const independent=authenticateIndependentSourceReview(comments,reviews,
    approval.testedCommit,pr.user.login,process.env.LUMA_RELEASE_TRUSTED_REVIEWERS,
    contributors);
  console.log('EXTERNAL_REVIEW_VERIFIED',JSON.stringify(independent));
  const criticPath=resolve(directory,'evidence/cicd-enterprise/granite-review.json');
  const verifierPath=resolve(directory,'evidence/cicd-enterprise/independent-review.json');
  invariant(sha(criticPath) === approval.critic?.sha256 && sha(verifierPath) === approval.verifier?.sha256,
    'Independent evidence was modified');
  const critic=JSON.parse(readFileSync(criticPath,'utf8'));
  const verifier=JSON.parse(readFileSync(verifierPath,'utf8'));
  invariant(critic.complete === true && critic.reviewedSourceDigest === source &&
    verifier.status === 'PASS' && verifier.reviewedSourceDigest === source &&
    verifier.unresolvedCritical === 0 && verifier.unresolvedHigh === 0 &&
    approval.unresolvedCritical === 0 && approval.unresolvedHigh === 0,
    'Critic/verifier evidence incomplete or stale');
  const dispositions = new Map((verifier.dispositions ?? []).map(item => [item.id,item]));
  for (const finding of critic.evaluation?.findings ?? []) {
    if (finding.severity === 'critical' || finding.severity === 'high') {
      const decision = dispositions.get(finding.id);
      invariant(decision && ['resolved','false-positive'].includes(decision.status) &&
        Array.isArray(decision.evidence) && decision.evidence.length > 0,
        `Unresolved adversarial finding: ${finding.id}`);
    }
  }
  // PR-owned critic text cannot grant permission; the Codex app's real review
  // identity/status was independently authenticated from GitHub above.
  const signed=signApproval({ ...approval,
    review: { ...independent, commitSha: approval.testedCommit },
  },process.env.LUMA_RELEASE_ATTESTATION_PRIVATE_KEY_B64);
  verifyApprovalSignature(signed,process.env.LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64);
  writeFileSync(approvalPath,JSON.stringify(signed,null,2)+'\n');
  // Reuse the protected-base source/Graph verifier over the inert candidate.
  verifyReview(directory);
  writeFileSync(resolve(ROOT,'release-approval-signed.json'),JSON.stringify(signed,null,2)+'\n');
  process.stdout.write(JSON.stringify({status:'SIGNED',sourceDigest:source,sourceCommit:approval.testedCommit,
    signedArtifact:'release-approval-signed.json',pr:Number(prArg)})+'\n');
}

if (process.argv[1] && /trusted-attestor\.mjs$/.test(process.argv[1])) {
  main().catch(error => { console.error('INDEPENDENT_ATTESTATION_BLOCKED: '+error.message);process.exitCode=1; });
}
