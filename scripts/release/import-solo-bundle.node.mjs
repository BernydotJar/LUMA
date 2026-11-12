import test from 'node:test';import assert from 'node:assert/strict';
import {validateBundleManifest} from './import-solo-bundle.mjs';
const paths=['graph-harness.events.jsonl','evidence/cicd-enterprise/granite-review.json',
'evidence/cicd-enterprise/independent-review.json','evidence/cicd-enterprise/release-ci.json',
'evidence/cicd-enterprise/release-approval.json'];
const f=Object.fromEntries(paths.map((p,i)=>[p,String(i).repeat(64)]));
test('sealed bundle manifest pins exactly five evidence files for frozen source',()=>{
  const m={schemaVersion:3,status:'SIGNED',testedCommit:'a'.repeat(40),sourceDigest:'b'.repeat(64),files:f};
  assert.equal(validateBundleManifest(m,f,m.testedCommit,m.sourceDigest),true);
  assert.throws(()=>validateBundleManifest({...m,files:{...m.files,['src/app/page.tsx']:'f'.repeat(64)}},f,m.testedCommit,m.sourceDigest));
  assert.throws(()=>validateBundleManifest(m,{...f,[paths[0]]:'e'.repeat(64)},m.testedCommit,m.sourceDigest));
  assert.throws(()=>validateBundleManifest(m,f,'c'.repeat(40),m.sourceDigest));
});
