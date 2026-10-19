import { test } from 'vitest';
import assert from 'node:assert/strict';
import { promotionStarted } from './recovery-policy.mjs';

test('recovery is unnecessary on review, preflight, upload, or build failures', () => {
  for (const phase of ['RELEASE_FAILED','PREFLIGHT_PASSED','SOURCE_UPLOADED','BUILD_READY']) {
    assert.equal(promotionStarted({ events: [{ phase }, { phase: 'RELEASE_FAILED' }] }), false);
  }
});

test('a rollout initiated before failure requires the guarded recovery path', () => {
  assert.equal(promotionStarted({events:[{phase:'PREFLIGHT_PASSED'},{phase:'PROMOTION_STARTED'},{phase:'RELEASE_FAILED'}]}), true);
});

test('missing or malformed release ledger never produces a false safe recovery decision', () => {
  for (const value of [null,{}, {events:null},{events:'not-an-array'}]) {
    assert.throws(() => promotionStarted(value), /missing or corrupt/);
  }
});
