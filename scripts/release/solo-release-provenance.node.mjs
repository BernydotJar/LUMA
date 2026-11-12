import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticateOwnerAuthorization, assertCurrentSoloApproval } from './solo-release-provenance.mjs';
const SHA = 'a'.repeat(40), DIGEST='b'.repeat(64);
const date='2026-11-11T15:59:00Z';
const comment=(text, id=77, stamp='2026-11-11T16:00:00Z', login='BernydotJar') => ({
  id, user:{login,type:'User'},body:text,created_at:stamp,updated_at:stamp });
const accept=(scope='public-landing',sha=SHA)=>`LUMA_SOLO_RELEASE_APPROVAL_V1 sha=${sha} scope=${scope}`;
const revoke=(scope='public-landing',sha=SHA)=>`LUMA_SOLO_RELEASE_REVOKE_V1 sha=${sha} scope=${scope}`;

test('one real owner decision after a model review is source and scope bound',()=>{
  assert.equal(authenticateOwnerAuthorization([comment(accept())],SHA,date,'public-landing').commentId,77);
});
test('self-claims, wrong SHA, edits, old comments and revocations cannot approve',()=>{
  for(const v of [
    [comment(accept(),'77',date)],
    [comment(accept('owner-risk-exception'))],
    [comment(accept('public-landing','c'.repeat(40)))],
    [{...comment(accept()),user:{login:'fake-human',type:'User'}}],
    [{...comment(accept()),updated_at:'2026-11-11T17:00:00Z'}],
    [comment(accept(),77,'2026-11-11T15:00:00Z')],
    [comment(accept()),comment(revoke(),78,'2026-11-11T16:01:00Z')],
  ]) assert.throws(()=>authenticateOwnerAuthorization(v,SHA,date,'public-landing'));
});
const run=()=>({id:42,workflow_id:400, path:'.github/workflows/granite-protected-review.yml',
  event:'workflow_dispatch',head_branch:'main',status:'completed',conclusion:'success',
  updated_at:date, head_sha:SHA, repository:{full_name:'BernydotJar/LUMA'},head_repository:{full_name:'BernydotJar/LUMA'}});
const receipt=()=>({schemaVersion:3,status:'PASS',testedCommit:SHA,
  review:{commitSha:SHA, workflowRunId:42,artifactDigestSha256:DIGEST,modelDigest:DIGEST,trustedWorkflowCommit:SHA,
    modelVerdict:'PASS',codexReviewCommentId:0},
  ownerAuthorization:{commitSha:SHA,commentId:77,login:'BernydotJar',method:'github-issue-comment',scope:'public-landing'}});
const pr=()=>({number:101,head:{sha:SHA,repo:{full_name:'BernydotJar/LUMA'}},base:{ref:'main'},state:'open',merged:false});
const input=()=>({approval:receipt(),pr:pr(),expectedHead:SHA,commits:[{sha:SHA}],compare:null,
  comments:[comment(accept())],run:run(),jobs:[{name:'granite-adversarial-review',conclusion:'success'}],
  artifact:{workflow_run:{id:42},name:'granite-protected-101-42',expired:false,digest:`sha256:${DIGEST}`},
  trustedWorkflowId:400,trustedModelDigest:DIGEST,expectedProtectedPolicySha:SHA});
test('protected current-approval recheck verifies model and owner decision',()=>{
  const verified=assertCurrentSoloApproval(input());
  assert.equal(verified.humanIndependent,false);
  assert.equal(verified.modelReviewRunId,42);
});
test('recheck rejects forged run, mismatched artifact, later revocation and changed source',()=>{
  const d=input();
  assert.throws(()=>assertCurrentSoloApproval({...d,run:{...d.run,event:'pull_request'}}));
  assert.throws(()=>assertCurrentSoloApproval({...d,expectedProtectedPolicySha:'c'.repeat(40)}));
  assert.throws(()=>assertCurrentSoloApproval({...d,artifact:{...d.artifact,digest:`sha256:${'f'.repeat(64)}`}}));
  assert.throws(()=>assertCurrentSoloApproval({...d,comments:[comment(accept()),comment(revoke(),78,'2026-11-11T16:01:00Z')]}));
  assert.throws(()=>assertCurrentSoloApproval({...d,expectedHead:'c'.repeat(40)}));
  assert.throws(()=>assertCurrentSoloApproval({...d,trustedModelDigest:'c'.repeat(64)}));
});

test('v3 imports precisely the five signed evidence files in a single evidence-only commit',()=>{
  const c0=SHA,c1='c'.repeat(40),d=input();
  const changes=[
    'graph-harness.events.jsonl',
    'evidence/cicd-enterprise/granite-review.json',
    'evidence/cicd-enterprise/independent-review.json',
    'evidence/cicd-enterprise/release-ci.json',
    'evidence/cicd-enterprise/release-approval.json',
  ].map(filename=>({filename,status:'modified'}));
  const compare={status:'ahead',ahead_by:1,behind_by:0,base_commit:{sha:c0},
    commits:[{sha:c1,parents:[{sha:c0}]}],files:changes};
  const proof={...d,pr:{...d.pr,head:{...d.pr.head,sha:c1}},expectedHead:c1,
    commits:[{sha:c0},{sha:c1}],compare};
  assert.equal(assertCurrentSoloApproval(proof).modelReviewRunId,42);
  for(const altered of [changes.slice(0,4),
    [...changes.slice(0,4),{filename:'.github/workflows/quality.yml',status:'modified'}],
    [...changes.slice(0,4),{filename:changes[4].filename,status:'added'}]]) {
    assert.throws(()=>assertCurrentSoloApproval({...proof,compare:{...compare,files:altered}}));
  }
});

test('public-only advisory requires a real authenticated clean Codex bot receipt on the same SHA',()=>{
  const d=input();const review={...d.approval.review,modelVerdict:'NEEDS_REVIEW',codexReviewCommentId:951};
  const commentBody=`<!-- codex-review-state:v1 ${JSON.stringify({code_review:{commit_sha:SHA,status:'completed',has_any_findings:false,has_unresolved_findings:false}})} -->`;
  const bot={id:951,user:{login:'chatgpt-codex-connector[bot]',type:'Bot'},body:commentBody};
  const amended={...d,approval:{...d.approval,review},comments:[...d.comments,bot]};
  assert.equal(assertCurrentSoloApproval(amended).codexReviewCommentId,951);
  assert.throws(()=>assertCurrentSoloApproval({...amended,comments:d.comments}));
  assert.throws(()=>assertCurrentSoloApproval({...amended,comments:[...d.comments,{...bot,user:{login:'random-bot',type:'Bot'}}]}));
  assert.throws(()=>assertCurrentSoloApproval({...amended,comments:[...d.comments,{...bot,body:commentBody.replace('false','true')}]}));
  assert.throws(()=>assertCurrentSoloApproval({...amended,approval:{...amended.approval,
    ownerAuthorization:{...amended.approval.ownerAuthorization,scope:'owner-risk-exception'}}}));
});

test('newer adverse Codex opinion supersedes an older signed clean opinion',()=>{
  const d=input();const state=(sha,hasFindings)=>`<!-- codex-review-state:v1 ${JSON.stringify({code_review:{commit_sha:sha,status:'completed',has_any_findings:hasFindings,has_unresolved_findings:hasFindings}})} -->`;
  const clean={id:951,user:{login:'chatgpt-codex-connector[bot]',type:'Bot'},
    created_at:'2026-11-11T16:00:00Z',updated_at:'2026-11-11T16:00:00Z',body:state(SHA,false)};
  const adverse={...clean,id:952,created_at:'2026-11-11T16:01:00Z',updated_at:'2026-11-11T16:01:00Z',body:state(SHA,true)};
  const signed={...d,approval:{...d.approval,review:{...d.approval.review,
    modelVerdict:'NEEDS_REVIEW',codexReviewCommentId:951}},comments:[...d.comments,clean]};
  assert.equal(assertCurrentSoloApproval(signed).codexReviewCommentId,951);
  assert.throws(()=>assertCurrentSoloApproval({...signed,comments:[...signed.comments,adverse]}));
  assert.throws(()=>assertCurrentSoloApproval({...signed,comments:[...d.comments,
    {...clean,body:state(SHA,true)}]}));
});
test('receipt-only C1 may use latest clean Codex review on identical source with updated commit',()=>{
  const d=input(),C1='c'.repeat(40);
  const paths=['graph-harness.events.jsonl','evidence/cicd-enterprise/granite-review.json',
    'evidence/cicd-enterprise/independent-review.json','evidence/cicd-enterprise/release-ci.json',
    'evidence/cicd-enterprise/release-approval.json'];
  const comment={id:951,user:{login:'chatgpt-codex-connector[bot]',type:'Bot'},
    created_at:'2026-11-11T16:00:00Z',updated_at:'2026-11-11T16:05:00Z',
    body:`<!-- codex-review-state:v1 ${JSON.stringify({code_review:{commit_sha:C1,status:'completed',has_any_findings:false,has_unresolved_findings:false}})} -->`};
  const compare={status:'ahead',ahead_by:1,behind_by:0,base_commit:{sha:SHA},
    commits:[{sha:C1,parents:[{sha:SHA}]}],files:paths.map(filename=>({filename,status:'modified'}))};
  const updated={...d,approval:{...d.approval,review:{...d.approval.review,
    modelVerdict:'NEEDS_REVIEW',codexReviewCommentId:951}},
    pr:{...d.pr,head:{...d.pr.head,sha:C1}},expectedHead:C1,
    commits:[{sha:SHA},{sha:C1}],compare,comments:[...d.comments,comment]};
  assert.equal(assertCurrentSoloApproval(updated).codexReviewCommentId,951);
  assert.throws(()=>assertCurrentSoloApproval({...updated,compare:null}));
});
