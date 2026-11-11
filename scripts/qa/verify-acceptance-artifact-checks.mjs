import test from 'node:test';
import assert from 'node:assert/strict';
import { assertUatProvenance } from './verify-acceptance-artifact.mjs';
const sha='a'.repeat(40);
const run={id:82442,workflow_id:1234,path:'.github/workflows/luma-independent-uat.yml',repository:{id:1403901485,full_name:'BernydotJar/LUMA'},
  head_repository:{id:1403901485,full_name:'BernydotJar/LUMA'},head_sha:sha,head_branch:'main',
  event:'workflow_dispatch',status:'completed',conclusion:'success',
  actor:{login:'Trusted-Independent'},triggering_actor:{login:'Trusted-Independent'},
  created_at:'2026-11-11T03:45:00Z'};
const artifacts={artifacts:[{id:4,name:'luma-acceptance-private-evidence',expired:false,
  size_in_bytes:1024,workflow_run:{id:82442,head_sha:sha},
  created_at:'2026-11-11T03:48:00Z'}]};
const expected={runId:'82442',workflowId:'1234',workflowPath:'.github/workflows/luma-independent-uat.yml',trustedActors:'trusted-independent',
  repo:'BernydotJar/LUMA',sha,promotionAt:'2026-11-11T03:40:00Z'};
test('a verified independently dispatched exact-source UAT is accepted',()=>{
  assert.equal(assertUatProvenance(run,artifacts,expected).runId,82442);
});
for(const [name,edited,art,env] of [
  ['wrong checkout', {...run,head_sha:'b'.repeat(40)},artifacts,expected],
  ['PR-sourced run', {...run,event:'pull_request'},artifacts,expected],
  ['untrusted actor', {...run,actor:{login:'attacker'}},artifacts,expected],
  ['wrong workflow', {...run,workflow_id:99},artifacts,expected],
  ['wrong workflow path', {...run,path:'.github/workflows/malicious.yml'},artifacts,expected],
  ['run failed', {...run,conclusion:'failure'},artifacts,expected],
  ['stale run', {...run,created_at:'2026-11-11T03:00:00Z'},artifacts,expected],
  ['stale artifact',run,{artifacts:[{...artifacts.artifacts[0],created_at:'2026-11-11T03:00:00Z'}]},expected],
  ['fork run', {...run,head_repository:{id:1000}},artifacts,expected],
  ['artifact from another run',run,{artifacts:[{...artifacts.artifacts[0],workflow_run:{id:987,head_sha:sha}}]},expected],
  ['no registered trusted actor',run,artifacts,{...expected,trustedActors:''}],
])test('reject '+name,()=>{
  assert.throws(()=>assertUatProvenance(edited,art,env));
});
