import { test } from 'vitest';
import assert from 'node:assert/strict';
import { validateAuthenticatedCloudUatReceipt } from './validated-luma-cloud-uat.mjs';

const sha='a'.repeat(40),now=Date.UTC(2026,9,21,6,0,0);
const clean={qaSourceSha:sha,startedAt:new Date(now+1000).toISOString(),
  overall:'PASS_AUTHENTICATED_LUMA_CLOUD_E2E',cloudAcceptance:'PROVIDER_AND_APP_CLOUD_PASS',
  results:Array.from({length:36},(_,i)=>({name:'action-'+i,result:'PASS'})),
  passCount:36,failCount:0,blockedCount:0};
const accept=(report=clean,overrides={})=>validateAuthenticatedCloudUatReceipt({
  report,expectedSourceSha:sha,runStartedAtMs:now,reportMtimeMs:now+2000,
  childExitCode:0,...overrides,
});

test('accepts only a fresh same-SHA complete authenticated Cloud UAT',()=>{
  assert.deepEqual(accept(),{sourceSha:sha,overall:clean.overall,pass:36,fail:0,blocked:0});
});
test('a stale historical green report is rejected even when it contains 36 PASS',()=>{
  assert.throws(()=>accept(clean,{reportMtimeMs:now-30000}),/QA_REPORT_STALE/);
  assert.throws(()=>accept({...clean,startedAt:new Date(now-30000).toISOString()}),
    /QA_REPORT_STARTED_BEFORE_THIS_RUN/);
  assert.throws(()=>accept({...clean,qaSourceSha:'b'.repeat(40)}),/QA_SOURCE_SHA_MISMATCH/);
});
test('child crash or missing report can never inherit PASS',()=>{
  assert.throws(()=>accept(clean,{childExitCode:1}),/QA_CHILD_FAILED/);
  assert.throws(()=>accept(null),/QA_REPORT_MISSING/);
  assert.throws(()=>accept(clean,{childExitCode:null}),/QA_CHILD_FAILED/);
});
test('partial, duplicate, inconsistent and self-certified results fail closed',()=>{
  assert.throws(()=>accept({...clean,results:clean.results.slice(0,12),passCount:12}),/QA_REQUIRED_ACTIONS/);
  assert.throws(()=>accept({...clean,results:[...clean.results.slice(0,35),clean.results[0]]}),/QA_DUPLICATE/);
  assert.throws(()=>accept({...clean,failCount:1}),/QA_COUNTS/);
  assert.throws(()=>accept({...clean,results:[...clean.results.slice(0,35),{name:'action-35',result:'FAIL'}]}),/QA_REQUIRED_ACTIONS/);
  assert.throws(()=>accept({...clean,cloudAcceptance:'NO_GO'}),/QA_NOT_COMPLETE/);
});
