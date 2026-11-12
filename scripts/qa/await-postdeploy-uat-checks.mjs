import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eligibleRun } from './await-postdeploy-uat.mjs';
const sha='a'.repeat(40);
const expected={ workflowId:'1234',workflowPath:'.github/workflows/independent-uat.yml',
  actors:'external-reviewer',sha,promotionAt:'2026-11-11T17:00:00Z' };
const valid={id:900,workflow_id:1234,path:expected.workflowPath,
  repository:{id:1403901485},head_repository:{id:1403901485},
  head_sha:sha,head_branch:'main',event:'workflow_dispatch',
  actor:{login:'external-reviewer'},triggering_actor:{login:'external-reviewer'},
  created_at:'2026-11-11T17:10:00Z',conclusion:'success',status:'completed'};
test('accept independently dispatched post-promotion candidate',()=>{
  assert.equal(eligibleRun(valid,expected),true);
});
for(const [label,patch,options] of [
  ['stale run',{created_at:'2026-11-11T16:59:59Z'}],
  ['exact instant is not after',{created_at:'2026-11-11T17:00:00Z'}],
  ['wrong SHA',{head_sha:'b'.repeat(40)}],
  ['PR event',{event:'pull_request'}],
  ['fork run',{head_repository:{id:123}}],
  ['wrong repo',{repository:{id:123}}],
  ['wrong workflow',{workflow_id:12}],
  ['wrong workflow path',{path:'.github/workflows/fake.yml'}],
  ['wrong branch',{head_branch:'dev'}],
  ['untrusted actor',{actor:{login:'author'}}],
  ['untrusted trigger',{triggering_actor:{login:'author'}}],
  ['missing actor allowlist',{}, {...expected,actors:''}],
])test('reject '+label,()=>{
  assert.equal(eligibleRun({...valid,...patch},options||expected),false);
});
