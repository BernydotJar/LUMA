import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReviewRisk,prepareDiffChunks,verifyCitedFinding,validateChangedPaths, MAX_MODEL_PROMPT_BYTES } from './granite-diff.mjs';
test('deleted or modified security workflow never qualifies for public-only release',()=>{
  assert.equal(classifyReviewRisk([{status:'D',path:'.github/workflows/source-attestation.yml'},
    {status:'M',path:'src/app/page.tsx'}]).classification,'owner-risk-exception-required');
  assert.equal(classifyReviewRisk([{status:'D',path:'public/old-banner.png'}]).classification,'owner-risk-exception-required');
  assert.equal(classifyReviewRisk([{status:'M',path:'src/app/page.tsx'}]).classification,'public-landing');
  assert.equal(classifyReviewRisk([{status:'M',path:'graph-harness.project.json'},
    {status:'M',path:'src/app/page.tsx'}]).classification,'owner-risk-exception-required');
  assert.equal(classifyReviewRisk([{status:'M',path:'evidence/cicd-enterprise/release-approval.json'},
    {status:'M',path:'src/app/page.tsx'}]).classification,'owner-risk-exception-required');
  assert.equal(classifyReviewRisk([{status:'M',path:'AGENTS.md'}]).classification,'owner-risk-exception-required');
  assert.equal(classifyReviewRisk([{status:'A',path:'e2e/seres-landing.spec.ts'},
    {status:'M',path:'src/app/seres-landing.module.css'}]).classification,'public-landing');
});
test('30 paths are supported without silently omitting deleted files',()=>{
  const many=Array.from({length:35},(_,i)=>({status:i===34?'D':'M',path:`src/app/page-${i}.tsx`}));
  assert.equal(validateChangedPaths(many).length,35);
  assert.throws(()=>validateChangedPaths([...many,many[0]]));
});
test('entire diffs including deletions split at bounded byte budgets',()=>{
  const x='diff --git a/src/app/page.tsx b/src/app/page.tsx\n--- a/src/app/page.tsx\n+++ b/src/app/page.tsx\n@@ -10,3 +10,4 @@\n-old code\n+new code\n unchanged\n';
  const repeated=x+'@@ -30,120 +30,120 @@\n'+Array.from({length:118},(_,i)=>`+new code item ${i}`).join('\n')+'\n';
  const chunks=prepareDiffChunks('src/app/page.tsx',repeated,450);
  assert.ok(chunks.length>1);
  assert.ok(chunks.every(x=>Buffer.byteLength(x)<=450));
  assert.ok(chunks.join('').includes('OLD 10: old code'));
  assert.ok(chunks.join('').includes('NEW 10: new code'));
  assert.ok(chunks.join('').includes('NEW 147: new code item 117'));
  assert.ok(MAX_MODEL_PROMPT_BYTES<8192);
});
test('the model cannot cite a nonexistent deletion or forged line',()=>{
  const cited={path:'scripts/release/policy.mjs',side:'old',line:2,quote:'deleted trusted signing',severity:'high'};
  assert.ok(verifyCitedFinding(cited,cited.path,'safe\ndeleted trusted signing','safe\nupdated'));
  assert.throws(()=>verifyCitedFinding({...cited,line:3},cited.path,'safe\ndeleted trusted signing','safe\nupdated'));
  assert.throws(()=>verifyCitedFinding({...cited,side:'new'},cited.path,'safe\ndeleted trusted signing','safe\nupdated'));
});
