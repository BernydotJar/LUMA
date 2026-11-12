import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signApproval } from './approval-signature.mjs';
import { receiptCommentBody,parseReceiptComment,selectSignedReceipt } from './remote-attestation.mjs';
import { assertReviewAttestation,verifyReview } from './review-gate.mjs';
import { assertCurrentIndependentReview } from './live-review-check.mjs';
import { buildUnsignedProtectedApproval,selectAuthenticSourceCheckRun } from './trusted-attestor.mjs';
import { identifyGitHubSource } from './pr-readiness.mjs';

const head='a'.repeat(40),digest='b'.repeat(64);
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pemPublic=Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64');
const pemPrivate=Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64');
const review={method:'github-codex-clean-review',reviewer:'chatgpt-codex-connector[bot]',
 reviewId:1501,commitSha:head};
const bare={schemaVersion:2,status:'PASS',sourceDigest:digest,testedCommit:head,
 ciRunId:'900045',graphEventId:'external-graph-event',graphEventHash:'c'.repeat(64),
 critic:{sha256:'d'.repeat(64)},verifier:{sha256:'e'.repeat(64)},
 unresolvedCritical:0,unresolvedHigh:0,review};
const signed=signApproval(bare,pemPrivate);
const comment={id:3433,created_at:'2026-11-11T19:00:00Z',
 user:{login:'github-actions[bot]'},performed_via_github_app:{slug:'github-actions'},
 body:receiptCommentBody(104,signed)};
const codex={id:review.reviewId,user:{login:'chatgpt-codex-connector[bot]'},
 created_at:'2026-11-11T19:01:00Z',
 body:'<!-- codex-review-state:v1 '+
 JSON.stringify({code_review:{commit_sha:head,status:'completed',
 has_any_findings:false,has_unresolved_findings:false}})+' -->'};
const pr={state:'open',merged:false,head:{sha:head,repo:{full_name:'BernydotJar/LUMA'}},
 base:{ref:'main'},user:{login:'dev-author'}};
const commits=[{sha:head,author:{login:'dev-author'},committer:{login:'dev-author'}}];
function selection(records=[comment],sha=head){return selectSignedReceipt(records,104,sha,pemPublic);}
test('trusted protected comment securely carries signed exact SHA outside Git',()=>{
 assert.equal(selection().approval.testedCommit,head);
 assert.equal(parseReceiptComment(comment).reviewedHead,head);
});
test('a copied receipt cannot approve a different candidate SHA',()=>{
 assert.throws(()=>selection([comment],'f'.repeat(40)),/No protected/);
});
test('unauthorized commenter cannot publish an approval even with real signature',()=>{
 const forged={...comment,user:{login:'dev-author'}};
 assert.throws(()=>selection([forged]),/No protected/);
});
test('wrong GitHub app cannot impersonate the protected signer',()=>{
 const forged={...comment,performed_via_github_app:{slug:'untrusted-pr-app'}};
 assert.throws(()=>selection([forged]),/No protected/);
});
test('modified signed payload is rejected cryptographically',()=>{
 const envelope=parseReceiptComment(comment);
 envelope.approval.sourceDigest='f'.repeat(64);
 const forged={...comment,body:comment.body.replace(JSON.stringify(parseReceiptComment(comment)),JSON.stringify(envelope))};
 assert.throws(()=>selection([forged]),/signature/);
});
test('stale source digest cannot pass the release source comparison',()=>{
 assert.throws(()=>assertReviewAttestation(signed,'f'.repeat(64)),/Source changed/);
});
test('candidate-authored proof never substitutes for a protected receipt inside CI',()=>{
 const old=process.env.GITHUB_ACTIONS;
 try{
  process.env.GITHUB_ACTIONS='true';
  assert.throws(()=>verifyReview('/tmp/anywhere'),/external independently signed/);
 }finally{
  if(old===undefined)delete process.env.GITHUB_ACTIONS;
  else process.env.GITHUB_ACTIONS=old;
 }
});
test('live Codex review must still agree with signed reviewer and current SHA',()=>{
 assert.deepEqual(assertCurrentIndependentReview(signed,pr,head,[codex],[],commits,''),review.reviewId ?
   {method:review.method,reviewer:review.reviewer,reviewId:review.reviewId}:null);
});
test('later changed findings revoke even a correctly signed old receipt',()=>{
 const bad={...codex,id:1600,created_at:'2026-11-11T19:02:00Z',
 body:codex.body.replace('"has_unresolved_findings":false','"has_unresolved_findings":true')};
 assert.throws(()=>assertCurrentIndependentReview(signed,pr,head,[codex,bad],[],commits,''),/findings/);
});
test('post-merge review is allowed only with explicit merged mode',()=>{
 const merged={...pr,state:'closed',merged:true};
 assert.throws(()=>assertCurrentIndependentReview(signed,merged,head,[codex],[],commits,''),/changed/);
 assert.equal(assertCurrentIndependentReview(signed,merged,head,[codex],[],commits,'',null,true).reviewId,
   review.reviewId);
});
test('protected signer derives commit and CI run instead of believing PR template',()=>{
 const template={testedCommit:'e'.repeat(40),sourceDigest:'f'.repeat(64),
 ciRunId:'456',graphEventId:'external-graph-event',graphEventHash:'c'.repeat(64)};
 const built=buildUnsignedProtectedApproval(template,digest,head,{id:900045},
   'd'.repeat(64),'e'.repeat(64),{status:'PASS',unresolvedCritical:0,unresolvedHigh:0},review);
 assert.equal(built.testedCommit,head);
 assert.equal(built.sourceDigest,digest);
 assert.equal(built.ciRunId,'900045');
});
test('reject missing independent verified Graph evidence or unresolved critic',()=>{
 const input={graphEventId:'',graphEventHash:'0'.repeat(64)};
 assert.throws(()=>buildUnsignedProtectedApproval(input,digest,head,{id:900045},
   'd'.repeat(64),'e'.repeat(64),{status:'PASS',unresolvedCritical:0,unresolvedHigh:0},review));
 assert.throws(()=>buildUnsignedProtectedApproval(bare,digest,head,{id:900045},
   'd'.repeat(64),'e'.repeat(64),{status:'PASS',unresolvedCritical:1,unresolvedHigh:0},review));
});
test('PR webhook source identity must match exact Github head and positive PR number',()=>{
 assert.deepEqual(identifyGitHubSource('pull_request',
  {number:104,pull_request:{head:{sha:head}}},head),
  {prNumber:104,head,allowMerged:false});
 assert.throws(()=>identifyGitHubSource('pull_request',
  {number:104,pull_request:{head:{sha:'0'}}},head));
 assert.throws(()=>identifyGitHubSource('workflow_dispatch',{},head));
});

test('protected signer is not triggered by PR source and cannot run candidate scripts',()=>{
 const workflow=readFileSync(resolve(import.meta.dirname,
   '../../.github/workflows/independent-attestation.yml'),'utf8');
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/environment: independent-attestation/);
 assert.match(workflow,/issues: write/);
 assert.doesNotMatch(workflow,/pull_request_target:/);
 assert.doesNotMatch(workflow,/run:\s*(npm|node|bash) candidate-data\//);
});
test('protected source check remains attached to the exact PR head event',()=>{
 const workflow=readFileSync(resolve(import.meta.dirname,
   '../../.github/workflows/source-attestation.yml'),'utf8');
 assert.match(workflow,/pull_request_target:/);
 assert.match(workflow,/pull_request_review:/);
 assert.doesNotMatch(workflow,/issue_comment:/);
 assert.match(workflow,/\/head/);
 assert.doesNotMatch(workflow,/\/merge/);
});
test('signer can rerun only authenticated original exact-PR source checks',()=>{
 const w=8,mainSha='d'.repeat(40),base={id:50,workflow_id:w,head_sha:head,
   status:'completed',conclusion:'failure',
   path:'.github/workflows/source-attestation.yml',event:'pull_request_target',
   pull_requests:[{number:104,head:{sha:head},base:{ref:'main',sha:mainSha}}]};
 assert.equal(selectAuthenticSourceCheckRun([base],w,104,head,mainSha).id,50);
 for(const changed of [
   {head_sha:'f'.repeat(40)},
   {workflow_id:w+1},
   {event:'issue_comment'},
   {pull_requests:[{number:105,head:{sha:head},base:{ref:'main',sha:mainSha}}]},
   {status:'in_progress'},
   {pull_requests:[{number:104,head:{sha:head},base:{ref:'main',sha:'f'.repeat(40)}}]},
 ]){
   assert.throws(()=>selectAuthenticSourceCheckRun([{...base,...changed}],w,104,head,mainSha));
 }
});
