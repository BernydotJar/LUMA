import { expect, test } from 'vitest';
import { authenticateExternalCodexReview, authenticateTrustedHumanReview,
  authenticateIndependentSourceReview, validateQualityRun, requireExactReviewedHead } from './trusted-attestor.mjs';
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


const external = { id: 901, user: { login: 'external-auditor', type: 'User' },
  state: 'APPROVED', commit_id: SHA, submitted_at: '2026-10-20T18:00:00Z' };

test('an external approved GitHub reviewer may replace a rate-limited Codex verdict', () => {
  const failedCodex = { ...good, id: 765,
    body: good.body.replace('"status":"completed"','"status":"failed"') };
  const receipt = authenticateIndependentSourceReview([failedCodex], [external], SHA,
    'BernydotJar', 'external-auditor');
  expect(receipt).toEqual({ method:'github-human-approval', reviewer:'external-auditor', reviewId:901 });
});

test('human self-approval and untrusted identities never authorize protected signing', () => {
  const author = { ...external, user: { login:'BernydotJar',type:'User' } };
  for(const [reviews,allowlist] of [
    [[author],'BernydotJar'], [[external],'BernydotJar'],
    [[{...external, user:{login:'external-auditor',type:'Bot'}}],'external-auditor'],
    [[{...external, user:{login:'external-auditor',type:'User'},state:'COMMENTED'}],'external-auditor'],
    [[external],''],
  ]) {
    expect(()=>authenticateTrustedHumanReview(reviews,SHA,'BernydotJar',allowlist)).toThrow();
  }
});

test('a stale, superseded, dismissed or changed-source approval is rejected', () => {
  expect(()=>authenticateTrustedHumanReview([{...external,commit_id:'b'.repeat(40)}],SHA,
    'BernydotJar','external-auditor')).toThrow();
  expect(()=>authenticateTrustedHumanReview([external,{...external,id:902,state:'CHANGES_REQUESTED',
    submitted_at:'2026-10-20T18:01:00Z'}],SHA,'BernydotJar','external-auditor')).toThrow();
  expect(()=>authenticateTrustedHumanReview([external,{...external,id:902,state:'DISMISSED',
    submitted_at:'2026-10-20T18:01:00Z'}],SHA,'BernydotJar','external-auditor')).toThrow();
  expect(()=>authenticateTrustedHumanReview([external],SHA,'BernydotJar','external-auditor',
    ['external-auditor'])).toThrow();
  const veto={...external,id:903,user:{login:'other-auditor',type:'User'},state:'CHANGES_REQUESTED'};
  expect(()=>authenticateTrustedHumanReview([external,veto],SHA,
    'BernydotJar','external-auditor,other-auditor')).toThrow();
});

test('verified independent Codex success works without human review, but unresolved findings never bypass', () => {
  const clean={...good,id:804};
  expect(authenticateIndependentSourceReview([clean],[],SHA,'BernydotJar','')).toEqual({
    method:'github-codex-clean-review', reviewer:'chatgpt-codex-connector[bot]',reviewId:804,
  });
  const findings={...clean,body:clean.body.replace('"has_unresolved_findings":false','"has_unresolved_findings":true')};
  expect(()=>authenticateIndependentSourceReview([findings],[external],SHA,
    'BernydotJar','external-auditor')).toThrow(/findings/);
  const veto={id:1950,user:{login:'human-auditor',type:'User'},commit_id:SHA,
    state:'CHANGES_REQUESTED',submitted_at:'2026-10-20T19:00:00Z'};
  expect(()=>authenticateIndependentSourceReview([clean],[veto],SHA,
    'BernydotJar','human-auditor')).toThrow(/Codex cannot override/);
  const running={...clean,body:clean.body.replace('"status":"completed"','"status":"running"')};
  expect(()=>authenticateIndependentSourceReview([running],[external],SHA,
    'BernydotJar','external-auditor')).toThrow(/running/);
});
