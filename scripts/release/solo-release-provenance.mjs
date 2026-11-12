/** Pure verification of authenticated GitHub governance objects. */
import { assertReceiptOnlyHeadAdvance } from './receipt-only.mjs';

const FULL_SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const REPO = 'BernydotJar/LUMA';
function block(unless,reason) { if (!unless) throw new Error('SOLO_RELEASE_BLOCKED: '+reason); }

/** The owner must explicitly record risk acceptance *after* the protected model review.
 * Candidate-provided or developer-created JSON is never sufficient.
 */
export function authenticateOwnerAuthorization(comments,sha,runCompletion,requiredScope,
  owner='BernydotJar') {
  block(FULL_SHA.test(sha ?? '') && Number.isFinite(Date.parse(runCompletion ?? '')),
    'Owner review SHA or completion time invalid');
  block(['public-landing','owner-risk-exception'].includes(requiredScope),
    'Unexpected release risk scope');
  const valid = (comments ?? []).filter(c => c?.user?.login === owner &&
    c.user.type === 'User' && Number.isSafeInteger(c.id) && c.id > 0 &&
    c.created_at === c.updated_at && Number.isFinite(Date.parse(c.created_at)) &&
    Date.parse(c.created_at) >= Date.parse(runCompletion))
    .filter(c => /^LUMA_SOLO_RELEASE_(?:APPROVAL|REVOKE)_V1 sha=[a-f0-9]{40} scope=(?:public-landing|owner-risk-exception)$/.test(c.body?.trim() ?? ''))
    .filter(c => c.body.includes(`sha=${sha} scope=${requiredScope}`))
    .sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id-b.id);
  const latest = valid.at(-1);
  block(latest?.body.startsWith('LUMA_SOLO_RELEASE_APPROVAL_V1 '),
    'Authenticated owner must explicitly approve the exact post-review SHA and scope');
  return { method:'github-issue-comment', login: owner, commentId: latest.id,
    commitSha:sha, scope:requiredScope, humanIndependent:false };
}

/** A protected model REVIEW is never rewritten as PASS. An additional
 * authenticated GitHub Codex bot clean receipt, pinned by comment ID and SHA,
 * is required before owner risk acceptance can lead to a signed release. */
export function authenticateCodexModelAdjudication(comments,sourceCommit,commentId){
  block(FULL_SHA.test(sourceCommit??'') &&
    Number.isSafeInteger(commentId) && commentId>0,
    'Codex adjudication must bind an authenticated source SHA and comment');
  const candidates=(comments??[]).filter(c=>c.id===commentId &&
    c.user?.login==='chatgpt-codex-connector[bot]' &&
    c.user?.type==='Bot' && typeof c.body==='string' &&
    c.body.includes('<!-- codex-review-state:v1 '));
  block(candidates.length===1,'Authenticated Codex bot review receipt unavailable');
  const m=candidates[0].body.match(/<!-- codex-review-state:v1 (\{[^\n]*\}) -->/);
  block(m,'Codex receipt state is malformed');
  let state;
  try{state=JSON.parse(m[1]).code_review;}catch{}
  block(state?.commit_sha===sourceCommit && state?.status==='completed' &&
    state.has_any_findings===false && state.has_unresolved_findings===false,
    'Adjudicating Codex review does not cleanly cover the exact source SHA');
  return {reviewer:'chatgpt-codex-connector[bot]',reviewCommentId:commentId,
    reviewedCommit:sourceCommit,humanIndependent:false};
}

export function assertCurrentSoloApproval({ approval, pr, expectedHead, commits, compare,
  comments, run, jobs, artifact, trustedWorkflowId, trustedModelDigest, expectedProtectedPolicySha }) {
  block(approval?.schemaVersion === 3 && approval.status === 'PASS' &&
    FULL_SHA.test(approval.testedCommit ?? '') &&
    approval.review?.commitSha === approval.testedCommit &&
    approval.ownerAuthorization?.commitSha === approval.testedCommit,
    'Signed v3 receipt is not bound to one source commit');
  block(pr?.head?.repo?.full_name === REPO && pr.base?.ref === 'main' &&
    pr.state === 'open' && pr.merged === false &&
    pr.head?.sha === expectedHead && FULL_SHA.test(expectedHead ?? ''),
    'PR no longer points at the signed review source');
  block(Array.isArray(commits) && commits.some(c=>c.sha === approval.testedCommit),
    'Signed review no longer belongs to PR history');
  assertReceiptOnlyHeadAdvance(approval.testedCommit,expectedHead,compare,'v3');
  block(run?.id === approval.review.workflowRunId &&
    run.workflow_id === trustedWorkflowId &&
    run.path === '.github/workflows/granite-protected-review.yml' &&
    run.event === 'workflow_dispatch' && run.head_branch === 'main' &&
    run.status === 'completed' && run.conclusion === 'success' &&
    run.repository?.full_name === REPO &&
    run.head_repository?.full_name === REPO &&
    run.head_sha === approval.review.trustedWorkflowCommit &&
    run.head_sha === expectedProtectedPolicySha,
    'Protected model reviewer is not currently authenticated and successful');
  block((jobs ?? []).filter(j => j.name === 'granite-adversarial-review' &&
    j.conclusion === 'success').length === 1,
    'Protected model reviewer job did not succeed');
  block(artifact?.workflow_run?.id === run.id &&
    artifact.name === `granite-protected-${pr.number}-${run.id}` &&
    artifact.expired === false &&
    artifact.digest === `sha256:${approval.review.artifactDigestSha256}` &&
    SHA256.test(approval.review.artifactDigestSha256 ?? ''),
    'Signed model artifact is unavailable or changed');
  block(['PASS','NEEDS_REVIEW'].includes(approval.review.modelVerdict) &&
    Number.isSafeInteger(approval.review.codexReviewCommentId) &&
    (approval.review.modelVerdict==='PASS' ? approval.review.codexReviewCommentId===0 :
      approval.review.codexReviewCommentId>0 && approval.ownerAuthorization.scope==='public-landing'),
    'Model warning without exact-source protected Codex adjudication cannot be accepted');
  if(approval.review.modelVerdict==='NEEDS_REVIEW')
    authenticateCodexModelAdjudication(comments,approval.testedCommit,
      approval.review.codexReviewCommentId);
  block(approval.review.modelDigest === trustedModelDigest &&
    SHA256.test(trustedModelDigest ?? ''),
    'Trusted model digest changed since signing');
  const granted = authenticateOwnerAuthorization(comments,approval.testedCommit,
    run.updated_at,approval.ownerAuthorization.scope);
  block(granted.login === approval.ownerAuthorization.login &&
    granted.commentId === approval.ownerAuthorization.commentId &&
    granted.method === approval.ownerAuthorization.method,
    'Owner authorization was revoked, deleted, or superseded');
  return { ...granted, modelReviewRunId: run.id,
    modelVerdict:approval.review.modelVerdict,
    codexReviewCommentId:approval.review.codexReviewCommentId,
    reviewerType:'automated-model-critic', humanIndependent:false };
}
