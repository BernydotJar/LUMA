import test from 'node:test';
import assert from 'node:assert/strict';
import {hashActualReviewInput} from './protected-granite-review.mjs';
const A='a'.repeat(64),B='b'.repeat(64),P='src/app/page.tsx';
test('actual Granite input digest binds source chunk, order, and filename',()=>{
  const xs=[{path:P,chunkIndex:0,sourceChunkHash:A},{path:P,chunkIndex:1,sourceChunkHash:B}];
  const a=hashActualReviewInput(xs);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.notEqual(a,hashActualReviewInput(xs.slice().reverse()));
  assert.notEqual(a,hashActualReviewInput([{...xs[0],sourceChunkHash:B},xs[1]]));
  assert.notEqual(a,hashActualReviewInput([{...xs[0],path:'next.config.ts'},xs[1]]));
});
test('actual Granite input digest cannot accept ungrounded or repeated chunks',()=>{
  assert.throws(()=>hashActualReviewInput([]));
  assert.throws(()=>hashActualReviewInput([{path:P,chunkIndex:0,sourceHash:A}]));
  assert.throws(()=>hashActualReviewInput([{path:P,chunkIndex:0,sourceChunkHash:'bad'}]));
  assert.throws(()=>hashActualReviewInput([{path:P,chunkIndex:0,sourceChunkHash:A},{path:P,chunkIndex:0,sourceChunkHash:A}]));
});
