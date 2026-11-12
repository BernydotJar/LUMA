import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signApproval } from './approval-signature.mjs';
import { receiptCommentBody,parseReceiptComment,selectSignedReceipt,assertPolicyBoundReceipt } from './remote-attestation.mjs';
import { assertReviewAttestation,verifyReview } from './review-gate.mjs';
import { assertCurrentIndependentReview } from './live-review-check.mjs';
import { buildUnsignedProtectedApproval,selectAuthenticSourceCheckRun,validateQualityRun,protectedQualityJobNames,assertProtectedQualityCore } from './trusted-attestor.mjs';
import { identifyGitHubSource } from './pr-readiness.mjs';

const head='a'.repeat(40),digest='b'.repeat(64),policySha='c'.repeat(40);
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pemPublic=Buffer.from(publicKey.export({type:'spki',format:'pem'})).toString('base64');
const pemPrivate=Buffer.from(privateKey.export({type:'pkcs8',format:'pem'})).toString('base64');
const review={method:'github-codex-clean-review',reviewer:'chatgpt-codex-connector[bot]',
 reviewId:1501,commitSha:head};
const bare={schemaVersion:3,status:'PASS',policySha,sourceDigest:digest,testedCommit:head,
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
test('policy SHA tampering invalidates a v3 signature',()=>{
 assert.throws(()=>selectSignedReceipt([
   {...comment,body:receiptCommentBody(104,{...signed,policySha:'f'.repeat(40)})}
 ],104,head,pemPublic),/signature/);
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
   'd'.repeat(64),'e'.repeat(64),{status:'PASS',unresolvedCritical:0,unresolvedHigh:0},review,policySha);
 assert.equal(built.testedCommit,head);
 assert.equal(built.sourceDigest,digest);
 assert.equal(built.ciRunId,'900045');
 assert.equal(built.policySha,policySha);
 assert.equal(built.schemaVersion,3);
});
test('reject missing independent verified Graph evidence or unresolved critic',()=>{
 const input={graphEventId:'',graphEventHash:'0'.repeat(64)};
 assert.throws(()=>buildUnsignedProtectedApproval(input,digest,head,{id:900045},
   'd'.repeat(64),'e'.repeat(64),{status:'PASS',unresolvedCritical:0,unresolvedHigh:0},review,policySha));
 assert.throws(()=>buildUnsignedProtectedApproval(bare,digest,head,{id:900045},
   'd'.repeat(64),'e'.repeat(64),{status:'PASS',unresolvedCritical:1,unresolvedHigh:0},review,policySha));
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
 assert.match(workflow,/github.event.pull_request.base.sha/);
 assert.doesNotMatch(workflow,/ref:.*github.sha/);
 assert.doesNotMatch(workflow,/\/merge/);
});
test('signer can rerun only authenticated original exact-PR source checks',()=>{
 const w=8,mainSha='d'.repeat(40),base={id:50,workflow_id:w,head_sha:head,
   status:'completed',conclusion:'failure',
   path:'.github/workflows/source-attestation.yml',event:'pull_request_target',
   pull_requests:[{number:104,head:{sha:head},base:{ref:'main',sha:mainSha}}]};
 assert.equal(selectAuthenticSourceCheckRun([base],w,104,head,mainSha).id,50);
 assert.equal(selectAuthenticSourceCheckRun([
   {...base,head_sha:mainSha,event:'pull_request_target'}
 ],w,104,head,mainSha).id,50);
 assert.throws(()=>selectAuthenticSourceCheckRun([
   {...base,head_sha:mainSha,event:'pull_request_review'}
 ],w,104,head,mainSha));
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

test('signed policy must match the exact protected main policy revision',()=>{
 assert.equal(assertPolicyBoundReceipt(signed,policySha),true);
 assert.throws(()=>assertPolicyBoundReceipt(signed,'f'.repeat(40)),/stale/);
 assert.throws(()=>assertPolicyBoundReceipt({...signed,policySha:undefined},policySha),/stale/);
});


function realQualityRun(workflowId){
 return {workflow_id:workflowId,path:'.github/workflows/quality.yml',
   repository:{full_name:'BernydotJar/LUMA'},
   head_repository:{full_name:'BernydotJar/LUMA'},
   head_sha:head,event:'pull_request',conclusion:'failure',
   pull_requests:[{number:104,head:{sha:head},base:{ref:'main',sha:policySha}}]};
}
const baseNames=['verify','security','firestore','identity-roles','browser',
  'release-readiness','deploy'];
const outcome=name=>name==='release-readiness'?'failure':
  ['deploy','product-acceptance-predeploy','postdeploy-acceptance',
   'rollback-on-failed-acceptance'].includes(name)?'skipped':'success';
test('source-bound protected quality seven-job baseline and additive candidate job',()=>{
 const src=readFileSync(resolve(import.meta.dirname,'../../.github/workflows/quality.yml'),'utf8');
 const names=protectedQualityJobNames(src);
 assert.deepEqual(names,['verify','attestation-contract','security','firestore',
   'identity-roles','browser','release-readiness','deploy']);
 const run=realQualityRun(11);
 const jobs=names.map(name=>({name,conclusion:outcome(name)}));
 assert.equal(validateQualityRun(run,jobs,head,11,baseNames,104,policySha),true);
 assert.throws(()=>validateQualityRun(run,jobs.filter(x=>x.name==='verify'),
   head,11,baseNames,104,policySha),/missing/);
 assert.throws(()=>validateQualityRun(run,jobs.map(x=>x.name==='attestation-contract'?
    {...x,conclusion:'failure'}:x),head,11,baseNames,104,policySha),/not approved/);
 assert.throws(()=>validateQualityRun(run,[...jobs,jobs[0]],head,11,baseNames,104,policySha),
   /Duplicate/);
});
test('a quality run from another PR or a stale protected main is invalid',()=>{
 const run=realQualityRun(11);
 const jobs=baseNames.map(name=>({name,conclusion:outcome(name)}));
 assert.equal(validateQualityRun(run,jobs,head,11,baseNames,104,policySha),true);
 assert.throws(()=>validateQualityRun(run,jobs,head,11,baseNames,105,policySha),/pull request/);
 assert.throws(()=>validateQualityRun(run,jobs,head,11,baseNames,104,'e'.repeat(40)),/pull request/);
 assert.throws(()=>validateQualityRun({...run,pull_requests:[]},jobs,head,11,baseNames,104,policySha),
   /pull request/);
});
test('candidate cannot replace protected main test steps with no-op successes',()=>{
 const full=readFileSync(resolve(import.meta.dirname,'../../.github/workflows/quality.yml'),'utf8');
 const begin=full.indexOf('  attestation-contract:');
 const next=full.indexOf('  security:',begin);
 assert.ok(begin>0&&next>begin);
 const stripped=full.slice(0,begin)+full.slice(next);
 // Remove only the exact sanctioned migration additions from each job.
 const first=stripped.indexOf('  release-readiness:');
 const second=stripped.indexOf('  deploy:',first);
 const release=stripped.slice(first,second)
   .replace('    needs: [verify, security, firestore, identity-roles, browser, attestation-contract]',
     '    needs: [verify, security, firestore, identity-roles, browser]')
   .replace('      issues: read\n','')
   .replace('      pull-requests: read\n','')
   .replace('          GH_TOKEN: ${{ github.token }}\n','')
   .replace('          LUMA_RELEASE_TRUSTED_REVIEWERS: ${{ vars.LUMA_RELEASE_TRUSTED_REVIEWERS }}\n','');
 const deploy=stripped.slice(second)
   .replace('      issues: read\n','')
   .replace('      pull-requests: read\n','')
   .replace('          LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64: ${{ vars.LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64 }}\n','')
   .replace('          LUMA_RELEASE_TRUSTED_REVIEWERS: ${{ vars.LUMA_RELEASE_TRUSTED_REVIEWERS }}\n','');
 const baseline=stripped.slice(0,first)+release+deploy;
 assert.equal(assertProtectedQualityCore(baseline,full),true);
 assert.equal(assertProtectedQualityCore(full,full),true);
 assert.throws(()=>assertProtectedQualityCore(baseline,
   full+'\ndefaults:\n  run:\n    shell: bash\n'),
   /workflow-wide execution controls/);
 for(const injected of [
   "'defaults':\n  run:\n    shell: sh\n",
   '"defaults":\n  run:\n    shell: sh\n',
   "? defaults\n: {run: {shell: sh}}\n",
   '"on": pull_request\n',
   "   \n'permissions': write\n"
 ]){
   assert.throws(()=>assertProtectedQualityCore(baseline,injected+full),
     /workflow-wide execution controls|Missing protected/);
 }
 assert.throws(()=>assertProtectedQualityCore(baseline,
   full.replace('run: node scripts/release/pr-readiness.mjs','run: echo bypass')),
   /protected job definition: release-readiness/);
 assert.throws(()=>assertProtectedQualityCore(baseline,
   full.replace('run: node scripts/release/apphosting.mjs deploy','run: echo bypass')),
   /protected job definition: deploy/);
 assert.throws(()=>assertProtectedQualityCore(baseline,
   full.replace('needs: [verify, security, firestore, identity-roles, browser, attestation-contract]',
     'needs: [verify, security, firestore, identity-roles, browser]')),
   /Attestation contract must gate/);
 assert.throws(()=>assertProtectedQualityCore(baseline,
   full.replace('      - run: npm run test:run','      - run: echo PASS')),
   /altered protected job definition/);
 assert.throws(()=>assertProtectedQualityCore(baseline,
   full.replace('  pull_request:', '  pull_request_target:')),
   /workflow-wide execution controls/);
});
test('future protected enterprise jobs cannot be removed from the candidate run',()=>{
 const enterprise=['verify','security','firestore','identity-roles','browser',
   'coach-rbac','institution-intake','institution-browser','institution-approval',
   'learning-auth-uat','Operational acceptance contract self-test (not a release approval)',
   'release-readiness','product-acceptance-predeploy','deploy','postdeploy-acceptance',
   'rollback-on-failed-acceptance'];
 const run=realQualityRun(12), oldJobs=baseNames.map(name=>({name,conclusion:outcome(name)}));
 assert.throws(()=>validateQualityRun(run,oldJobs,head,12,enterprise,104,policySha),
   /missing/);
 const full=enterprise.map(name=>({name,conclusion:outcome(name)}));
 assert.equal(validateQualityRun(run,full,head,12,enterprise,104,policySha),true);
 assert.throws(()=>validateQualityRun(run,full.map(x=>x.name==='learning-auth-uat'?
   {...x,conclusion:'skipped'}:x),head,12,enterprise,104,policySha),/not approved/);
});
