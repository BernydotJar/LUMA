import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProtectedArtifact} from './protected-granite-artifact.mjs';
const row=()=>({name:'granite-protected-101-42',workflow_run:{id:42},id:700,
  expired:false,digest:'sha256:'+'a'.repeat(64),size_in_bytes:1000});
test('selects exactly the GitHub-authenticated model review artifact',()=>{
  assert.equal(selectProtectedArtifact([row()],42,101).id,700);
});
test('rejects stale run, expired, unsigned, oversized and duplicated artifacts',()=>{
  for (const xs of [[],[row(),row()],[{...row(),expired:true}],
    [{...row(),workflow_run:{id:77}}],[{...row(),digest:'bad'}],
    [{...row(),size_in_bytes:99999999}]]) {
    assert.throws(()=>selectProtectedArtifact(xs,42,101));
  }
});
