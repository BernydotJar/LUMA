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
  updated_at:date, repository:{full_name:'BernydotJar/LUMA'},head_repository:{full_name:'BernydotJar/LUMA'}});
const receipt=()=>({schemaVersion:3,status:'PASS',testedCommit:SHA,
  review:{commitSha:SHA, workflowRunId:42,artifactDigestSha256:DIGEST,modelDigest:DIGEST},
  ownerAuthorization:{commitSha:SHA,commentId:77,login:'BernydotJar',method:'github-issue-comment',scope:'public-landing'}});
const pr=()=>({number:101,head:{sha:SHA,repo:{full_name:'BernydotJar/LUMA'}},base:{ref:'main'},state:'open',merged:false});
const input=()=>({approval:receipt(),pr:pr(),expectedHead:SHA,commits:[{sha:SHA}],compare:null,
  comments:[comment(accept())],run:run(),jobs:[{name:'granite-adversarial-review',conclusion:'success'}],
  artifact:{workflow_run:{id:42},name:'granite-protected-101-42',expired:false,digest:`sha256:${DIGEST}`},
  trustedWorkflowId:400,trustedModelDigest:DIGEST});
test('protected current-approval recheck verifies model and owner decision',()=>{
  const verified=assertCurrentSoloApproval(input());
  assert.equal(verified.humanIndependent,false);
  assert.equal(verified.modelReviewRunId,42);
});
test('recheck rejects forged run, mismatched artifact, later revocation and changed source',()=>{
  const d=input();
  assert.throws(()=>assertCurrentSoloApproval({...d,run:{...d.run,event:'pull_request'}}));
  assert.throws(()=>assertCurrentSoloApproval({...d,artifact:{...d.artifact,digest:`sha256:${'f'.repeat(64)}`}}));
  assert.throws(()=>assertCurrentSoloApproval({...d,comments:[comment(accept()),comment(revoke(),78,'2026-11-11T16:01:00Z')]}));
  assert.throws(()=>assertCurrentSoloApproval({...d,expectedHead:'c'.repeat(40)}));
  assert.throws(()=>assertCurrentSoloApproval({...d,trustedModelDigest:'c'.repeat(64)}));
});
