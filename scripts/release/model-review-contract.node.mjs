import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGraniteModelReview, validateProtectedGraniteProvenance } from './model-review-contract.mjs';

const s = 'a'.repeat(40), d = 'b'.repeat(64), m = 'c'.repeat(64), h = 'd'.repeat(64);
const base = () => ({
  schemaVersion: 1, kind: 'ai-adversarial-code-review', sourceSHA: s,
  sourceDigest: d, model: 'ibm/granite3.3:2b', modelDigest: m,
  promptSha256: h, inputSha256: h, status: 'REVIEW_COMPLETE',
  doneReason: 'stop', options: { temperature: 0 },
  independence: 'model-only; no human independent reviewer',
  riskClassification:'public-landing',
  fileReviews:[{path:'src/app/page.tsx',chunkIndex:0,sourceChunkHash:h,
    opinion:'PASS',attempts:[{status:'VALID',rawResponse:'{\"result\":\"PASS\"}'}]}],
  result: { verdict: 'PASS', findings: [], limitations: ['Model review only'] },
});
const expected = () => ({ sourceSha: s, sourceDigest: d, modelDigest: m });
const checked = (change, overrides) => validateGraniteModelReview(Object.assign(base(), change),
  Object.assign(expected(), overrides));

test('accepts a finished model-only PASS without representing a human reviewer', () => {
  const r = checked();
  assert.equal(r.verdict, 'PASS');
  assert.equal(r.humanIndependent, false);
});
test('rejects stale source, model swaps and missing model digest', () => {
  assert.throws(() => checked({ sourceSHA: 'f'.repeat(40) }), /different source/);
  assert.throws(() => checked({ sourceDigest: 'f'.repeat(64) }), /different source/);
  assert.throws(() => checked({ modelDigest: 'f'.repeat(64) }), /unpinned model/);
  assert.throws(() => checked({}, { modelDigest: undefined }), /Trusted model digest/);
  assert.throws(() => checked({ model: 'gemma:latest' }), /Incorrect or unpinned/);
});
test('rejects inconclusive, fake PASS, and fabricated human independence', () => {
  assert.throws(() => checked({ status: 'BLOCKED' }), /did not finish/);
  assert.throws(() => checked({ doneReason: 'length' }), /did not finish/);
  assert.throws(() => checked({ result: { verdict: 'PASS', findings: [{ severity: 'high' }], limitations: [] } }), /Model technical opinion contract malformed/);
  assert.throws(() => checked({ result: { verdict: 'NEEDS_REVIEW', findings: [], limitations: [] } }), /Model technical opinion contract malformed/);
  assert.throws(() => checked({ independence: 'independent-human-approval' }), /Never represent AI/);
});
const run = () => ({ id: 456, workflow_id: 789, path: '.github/workflows/granite-protected-review.yml',
  repository: { full_name: 'BernydotJar/LUMA' }, head_repository: { full_name: 'BernydotJar/LUMA' },
  event: 'workflow_dispatch', head_branch: 'main', status: 'completed', conclusion: 'success', head_sha: s });
const artifactSource = () => ({ kind: 'github-actions-artifact', workflowRunId: 456,
  fromAuthenticatedGitHubApi: true, artifactDigestSha256: h, evidence: base() });
const proven = ({ runValue = run(), jobs = [{ name: 'granite-adversarial-review', conclusion: 'success' }],
  artifact = artifactSource(), workflowId = 789 } = {}) => validateProtectedGraniteProvenance({
    run: runValue, jobs, artifactSource: artifact, expectedWorkflowId: workflowId,
    expectedSourceSha: s, expectedSourceDigest: d, trustedModelDigest: m,
    expectedTrustedWorkflowCommit:s,
  });
test('accepts GitHub-authenticated protected-run provenance only', () => {
  const result = proven();
  assert.equal(result.workflowRunId, 456);
  assert.equal(result.humanIndependent, false);
});
test('rejects untrusted workflow, PR jobs, wrong GitHub run and unsigned provenance', () => {
  assert.throws(() => proven({ runValue: { ...run(), event: 'pull_request' } }), /protected-main workflow/);
  assert.throws(() => proven({ runValue: { ...run(), path: '.github/workflows/quality.yml' } }), /protected-main workflow/);
  assert.throws(() => proven({ runValue: { ...run(), head_branch: 'feat/fake' } }), /protected-main workflow/);
  assert.throws(() => proven({ jobs: [] }), /model review job missing/);
  assert.throws(() => proven({ artifact: { ...artifactSource(), workflowRunId: 111 } }), /exact trusted workflow artifact/);
  assert.throws(() => proven({ artifact: { ...artifactSource(), fromAuthenticatedGitHubApi: false } }), /exact trusted workflow artifact/);
  assert.throws(() => proven({ workflowId: 123 }), /protected-main workflow/);
});

test('advisory Granite is not a fabricated PASS and only eligible for public-scope Codex adjudication',()=>{
  const evidence=base();
  evidence.status='ADVISORY_REVIEW_COMPLETE';
  evidence.result.verdict='NEEDS_REVIEW';
  evidence.fileReviews[0].opinion='REVIEW';
  const outcome=validateGraniteModelReview(evidence,expected());
  assert.equal(outcome.verdict,'NEEDS_REVIEW');
  assert.equal(outcome.requiresCodex,true);
  assert.throws(()=>validateGraniteModelReview({...evidence,riskClassification:'owner-risk-exception-required'},expected()));
  assert.throws(()=>validateGraniteModelReview({...evidence,result:{...evidence.result,verdict:'PASS'}},expected()));
  assert.throws(()=>validateGraniteModelReview({...evidence,fileReviews:[{...evidence.fileReviews[0],attempts:[]}]},expected()));
});
