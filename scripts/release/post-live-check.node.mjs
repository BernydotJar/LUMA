import test from 'node:test';import assert from 'node:assert/strict';
import {createLiveCheckPayload}from'./post-live-check.mjs';
const s='a'.repeat(40),p='b'.repeat(40);
const args=()=>({sourceSha:s,prNumber:101,verified:true,githubActions:'true',
 repository:'BernydotJar/LUMA',eventName:'issue_comment',policySha:p});
test('live issue-comment recheck writes a source-bound GitHub Actions check status',()=>{
 const ok=createLiveCheckPayload(args());assert.equal(ok.name,'source-attestation');
 assert.equal(ok.head_sha,s);assert.equal(ok.conclusion,'success');
 assert.equal(createLiveCheckPayload({...args(),verified:false}).conclusion,'failure');
});
test('no untrusted runner, wrong source, external repo or non-issue event can stamp the PR check',()=>{
 for(const invalid of [
  {...args(),githubActions:'false'}, {...args(),repository:'attacker/other'},
  {...args(),eventName:'pull_request_target'}, {...args(),sourceSha:'bad'},
  {...args(),policySha:'bad'}, {...args(),verified:'true'}, {...args(),prNumber:0},
 ])assert.throws(()=>createLiveCheckPayload(invalid));
});

test('comment revocation marks PR head pending, never early success',()=>{
 const pending=createLiveCheckPayload({...args(),verified:undefined,phase:'start'});
 assert.equal(pending.name,'source-attestation');
 assert.equal(pending.head_sha,s);
 assert.equal(pending.status,'in_progress');
 assert.equal(Object.hasOwn(pending,'conclusion'),false);
 assert.throws(()=>createLiveCheckPayload({...args(),phase:'start'}));
 assert.throws(()=>createLiveCheckPayload({...args(),phase:'other'}));
});
