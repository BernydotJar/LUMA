import { expect, test } from 'vitest';
import { authenticateExternalCodexReview, validateQualityRun, requireExactReviewedHead } from './trusted-attestor.mjs';
const SHA='a'.repeat(40);
const good = {user:{login:'chatgpt-codex-connector[bot]'},body:'<!-- codex-review-state:v1 '+
  JSON.stringify({code_review:{commit_sha:SHA,status:'completed',has_any_findings:false,has_unresolved_findings:false}})+' -->'};
const needed=['verify','security','firestore','identity-roles','browser',
  'coach-rbac','institution-intake','institution-browser','institution-approval'];
const jobs=[...needed.map(name=>({name,conclusion:'success'})),
  {name:'release-readiness',conclusion:'failure'},{name:'deploy',conclusion:'skipped'}];

test('trusted attestor accepts an actual Codex review receipt for exact SHA', () => {
  expect(authenticateExternalCodexReview([good],SHA)).toBe(true);
});

test('PR-authored self-reviews, stale SHAs, and unresolved findings cannot authorize signing', () => {
  const forged={...good,user:{login:'BernydotJar'}};
  expect(()=>authenticateExternalCodexReview([forged],SHA)).toThrow();
  expect(()=>authenticateExternalCodexReview([good],'b'.repeat(40))).toThrow();
  const bad={...good,body:good.body.replace('"has_unresolved_findings":false','"has_unresolved_findings":true')};
  expect(()=>authenticateExternalCodexReview([bad],SHA)).toThrow();
  expect(()=>authenticateExternalCodexReview([
    { ...good, updated_at: '2026-10-01T00:00:00Z' },
    { ...bad, updated_at: '2026-10-02T00:00:00Z' },
  ],SHA)).toThrow();
  expect(()=>authenticateExternalCodexReview([],SHA)).toThrow();
});

test('protected attestor requires nine verified checks from the registered GitHub quality workflow', () => {
  const workflowId=375119015;
  const run={head_sha:SHA,event:'pull_request',conclusion:'failure',workflow_id:workflowId,
    path:'.github/workflows/quality.yml',repository:{full_name:'BernydotJar/LUMA'},
    head_repository:{full_name:'BernydotJar/LUMA'}};
  expect(validateQualityRun(run,jobs,SHA,workflowId)).toBe(true);
  expect(()=>validateQualityRun({...run,head_sha:'b'.repeat(40)},jobs,SHA,workflowId)).toThrow();
  expect(()=>validateQualityRun({...run,workflow_id:workflowId+1},jobs,SHA,workflowId)).toThrow();
  expect(()=>validateQualityRun({...run,path:'.github/workflows/fake-quality.yml'},jobs,SHA,workflowId)).toThrow();
  expect(()=>validateQualityRun({...run,repository:{full_name:'other/repo'}},jobs,SHA,workflowId)).toThrow();
  expect(()=>validateQualityRun(run,jobs,SHA,undefined)).toThrow();
  expect(()=>validateQualityRun(run,jobs.map(j=>j.name==='coach-rbac'?{...j,conclusion:'failure'}:j),SHA,workflowId)).toThrow();
  expect(()=>validateQualityRun(run,[...jobs,{name:'unknown-check',conclusion:'failure'}],SHA,workflowId)).toThrow();
});

test('rejects ancestor CI and stale independent review on an advanced PR head', () => {
  const reviewed='a'.repeat(40);
  const newHead='b'.repeat(40);
  expect(requireExactReviewedHead(reviewed,reviewed,reviewed)).toBe(true);
  // The previous ancestor-only policy would have accepted this PR advance,
  // allowing a protected signer to attest UNTESTED changed source bytes.
  expect(()=>requireExactReviewedHead(reviewed,newHead,newHead)).toThrow(/exact matching/);
  expect(()=>requireExactReviewedHead(reviewed,reviewed,newHead)).toThrow(/exact matching/);
  expect(()=>requireExactReviewedHead(newHead,newHead,reviewed)).toThrow(/exact matching/);
  expect(()=>requireExactReviewedHead('invalid',newHead,newHead)).toThrow(/exact matching/);
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
test('protected signer cannot be triggered by candidate PR and never executes candidate code', () => {
  const workflow = readFileSync(resolve(import.meta.dirname,'../../.github/workflows/independent-attestation.yml'),'utf8');
  expect(workflow).toContain('workflow_dispatch:');
  expect(workflow).toContain('environment: independent-attestation');
  expect(workflow).toContain('refs/heads/main');
  expect(workflow).not.toMatch(/pull_request_target:|\n  pull_request:/);
  expect(workflow).not.toMatch(/run:\s*(npm|bash|node) candidate-data\//);
  expect(workflow).toContain('node protected-policy/scripts/release/trusted-attestor.mjs');
});
