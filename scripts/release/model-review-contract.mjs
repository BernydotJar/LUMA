/** Pure fail-closed contract for a protected Granite review lane.
 * Authentication is provided by GitHub's API response for the trusted workflow,
 * NEVER by PR-supplied JSON or a model-generated claim of independence.
 * This module does not sign, approve or grant permission to merge on its own.
 */
const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const REPO = 'BernydotJar/LUMA';
const WORKFLOW = '.github/workflows/granite-protected-review.yml';
const MODEL = 'ibm/granite3.3:2b';

function requireCondition(condition, message) {
  if (!condition) throw new Error(`MODEL_REVIEW_BLOCKED: ${message}`);
}

export function validateGraniteModelReview(evidence, expected) {
  requireCondition(SHA40.test(expected?.sourceSha ?? '') && SHA64.test(expected?.sourceDigest ?? ''),
    'Expected exact source identity missing');
  requireCondition(SHA64.test(expected?.modelDigest ?? ''),
    'Trusted model digest must be configured outside the PR');
  requireCondition(evidence?.schemaVersion === 1 && evidence.kind === 'ai-adversarial-code-review',
    'Unsupported Granite evidence schema');
  requireCondition(evidence.sourceSHA === expected.sourceSha &&
    evidence.sourceDigest === expected.sourceDigest, 'Granite reviewed a different source SHA/digest');
  requireCondition(evidence.model === MODEL && evidence.modelDigest === expected.modelDigest,
    'Incorrect or unpinned model');
  requireCondition(SHA64.test(evidence.promptSha256 ?? '') &&
    SHA64.test(evidence.inputSha256 ?? ''), 'Missing prompt or source-input provenance');
  requireCondition(evidence.status === 'REVIEW_COMPLETE' && evidence.doneReason === 'stop',
    'Model did not finish a valid structured review');
  requireCondition(evidence.result?.verdict === 'PASS' &&
    Array.isArray(evidence.result?.findings) &&
    Array.isArray(evidence.result?.limitations), 'Granite review is blocked or inconclusive');
  requireCondition(evidence.options?.temperature === 0,
    'Review must use reproducible configured temperature');
  requireCondition(evidence.independence === 'model-only; no human independent reviewer',
    'Never represent AI criticism as an independent human approval');
  requireCondition(!evidence.result.findings.some(f =>
    ['critical', 'high'].includes(f?.severity)), 'Unresolved critical/high model findings');
  return { reviewerType: 'automated-model-critic', model: MODEL,
    sourceSha: evidence.sourceSHA, sourceDigest: evidence.sourceDigest,
    modelDigest: evidence.modelDigest, verdict: 'PASS',
    humanIndependent: false };
}

/** Inputs run, jobs and artifactSource are required to be fetched by a protected
 * main-only signer via authenticated GitHub API, not read from the PR checkout.
 */
export function validateProtectedGraniteProvenance({ run, jobs, artifactSource,
  expectedWorkflowId, expectedSourceSha, expectedSourceDigest, trustedModelDigest }) {
  requireCondition(Number.isSafeInteger(expectedWorkflowId) && expectedWorkflowId > 0,
    'Expected protected workflow registration is missing');
  requireCondition(run?.id > 0 && run.workflow_id === expectedWorkflowId &&
    run.path === WORKFLOW && run.repository?.full_name === REPO &&
    run.head_repository?.full_name === REPO && run.event === 'workflow_dispatch' &&
    run.head_branch === 'main' && run.status === 'completed' &&
    run.conclusion === 'success' && SHA40.test(run.head_sha ?? ''),
    'Review must run in a successful registered protected-main workflow');
  requireCondition(Array.isArray(jobs) &&
    jobs.filter(j => j.name === 'granite-adversarial-review' && j.conclusion === 'success').length === 1,
    'Protected model review job missing or failed');
  requireCondition(artifactSource?.kind === 'github-actions-artifact' &&
    artifactSource.workflowRunId === run.id &&
    artifactSource.fromAuthenticatedGitHubApi === true &&
    SHA64.test(artifactSource.artifactDigestSha256 ?? ''),
    'Evidence must originate from the exact trusted workflow artifact');
  const envelope = validateGraniteModelReview(artifactSource.evidence, {
    sourceSha: expectedSourceSha, sourceDigest: expectedSourceDigest,
    modelDigest: trustedModelDigest,
  });
  return { ...envelope, workflowRunId: run.id,
    trustedWorkflowCommit: run.head_sha,
    artifactDigestSha256: artifactSource.artifactDigestSha256 };
}
