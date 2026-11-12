import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedLedger,validatePromotableLedger } from './recovery-ledger.mjs';

const sha='a'.repeat(40),oldSha='b'.repeat(40);
const manifest={gitSha:sha,runId:'451'};
const ledger={gitSha:sha,runId:'451',buildId:'gh-'+sha.slice(0,12)+'-451-1',
 status:'READY_FOR_PROMOTION',
 previous:{buildId:'gh-previous-329',gitSha:oldSha,knownGood:true},
 events:[{phase:'PREFLIGHT_PASSED'},{phase:'BUILD_READY'}]};
test('same-run previous build and candidate are valid before traffic changes',()=>{
 assert.equal(validatePromotableLedger(ledger,manifest,'1'),ledger.buildId);
 assert.equal(validatePreparedLedger(ledger,manifest,'1'),ledger.buildId);
});
for(const [label,update] of [
 ['foreign commit',{gitSha:'c'.repeat(40)}],
 ['foreign run',{runId:'999'}],
 ['foreign build',{buildId:'gh-forged-build'}],
 ['candidate as previous',{previous:{...ledger.previous,buildId:ledger.buildId}}],
 ['unverified previous',{previous:{...ledger.previous,knownGood:false}}],
 ['unsigned previous',{previous:{...ledger.previous,gitSha:null}}],
 ['missing preparation',{events:[{phase:'BUILD_READY'}]}],
 ['missing READY stage',{events:[{phase:'PREFLIGHT_PASSED'}]}],
])test('reject '+label,()=>assert.throws(()=>validatePreparedLedger({...ledger,...update},manifest,'1')));
test('do not promote a previously promoted or failed run',()=>{
 for(const status of ['PROMOTING','FAILED','AWAITING_BROWSER_VERIFICATION']){
  assert.throws(()=>validatePromotableLedger({...ledger,status},manifest,'1'));
 }
});
test('a run attempt never reuses an older candidate',()=>{
 assert.throws(()=>validatePreparedLedger(ledger,manifest,'2'));
});
