import { test } from 'vitest';
import assert from 'node:assert/strict';
import { assertServingRuntimeParity, verifyPublicRuntimeParity,
  LUMA_RUNTIME_ENDPOINTS } from './production-parity.mjs';

const manifest={schemaVersion:1,repository:'BernydotJar/LUMA',
  gitSha:'a'.repeat(40),gitTree:'b'.repeat(40),
  commitTime:'2026-10-21T06:00:00Z',runId:'39559387151'};
const observations=LUMA_RUNTIME_ENDPOINTS.map(endpoint=>({
  ...endpoint,versionHttp:200,healthHttp:200,learnerHttp:200,
  versionResponseUrl:`${endpoint.origin}/api/version`,
  healthResponseUrl:`${endpoint.origin}/api/health`,
  learnerResponseUrl:`${endpoint.origin}/learn`,
  version:{...manifest},health:{status:'ok',checks:{api:'ok',firestore:'ok'}},
}));

test('postdeploy parity requires both expected URLs serving same full reviewed SHA',()=>{
  const result=assertServingRuntimeParity(observations,manifest);
  assert.equal(result.status,'PASS');
  assert.equal(result.endpoints.length,2);
  assert.ok(result.endpoints.every(entry=>entry.sha===manifest.gitSha));
});

test('fails closed when Cloudflare still serves stale SHA or stale run ID',()=>{
  const old=observations.map(x=>({...x,version:{...x.version}}));
  old[1].version.gitSha='c'.repeat(40);
  assert.throws(()=>assertServingRuntimeParity(old,manifest),/Release SHA/);
  old[1].version.gitSha=manifest.gitSha;
  old[1].version.runId='38096269154';
  assert.throws(()=>assertServingRuntimeParity(old,manifest),/manifest mismatch/);
});

test('rejects missing host, repeated direct Firebase host, and unexpected proxy redirect',()=>{
  assert.throws(()=>assertServingRuntimeParity(observations.slice(0,1),manifest),/Both public/);
  assert.throws(()=>assertServingRuntimeParity([observations[0],observations[0]],manifest),/duplicated/);
  const redirected=observations.map(x=>({...x}));
  redirected[1].versionResponseUrl=observations[0].versionResponseUrl;
  assert.throws(()=>assertServingRuntimeParity(redirected,manifest),/redirected/);
});

test('rejects broken Firestore, API health, or either failed HTTP endpoint',()=>{
  const bad=observations.map(x=>({...x}));
  bad[1].health={status:'ok',checks:{api:'ok',firestore:'failed'}};
  assert.throws(()=>assertServingRuntimeParity(bad,manifest),/unhealthy/);
  bad[1]= {...observations[1],versionHttp:503};
  assert.throws(()=>assertServingRuntimeParity(bad,manifest),/HTTP check/);
});

test('read-only probe binds remote versions and health to origin, ignores stale caches',async()=>{
  const accesses=[];
  const request={get:async(url,opts)=>{
    accesses.push({url,opts});
    const isVersion=url.includes('/api/version?');
    const isHealth=url.includes('/api/health?');
    return {status:()=>200,ok:()=>true,url:()=>url,
      json:async()=>isVersion?manifest:
        isHealth?{status:'ok',checks:{api:'ok',firestore:'ok'}}:{}};
  }};
  const result=await verifyPublicRuntimeParity(request,manifest);
  assert.equal(result.status,'PASS');
  assert.equal(accesses.length,6);
  assert.ok(accesses.every(a=>a.opts.headers['Cache-Control']==='no-cache'));
  assert.ok(accesses.every(a=>a.url.includes('release_audit=')));
});
