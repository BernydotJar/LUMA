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
  const comments=gh(`repos/${REPO}/issues/${prArg}/comments?per_page=100`);
  authenticateExternalCodexReview(comments,approval.testedCommit);
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
  const signed=signApproval(approval,process.env.LUMA_RELEASE_ATTESTATION_PRIVATE_KEY_B64);
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
