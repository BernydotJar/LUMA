import { test } from 'vitest';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertReviewAttestation, reviewedSourceDigest, verifyReview } from './review-gate.mjs';
const digest = 'a'.repeat(64);
const approval = { schemaVersion: 1, status: 'PASS', sourceDigest: digest, unresolvedCritical: 0, unresolvedHigh: 0, graphEventId: 'event-1', graphEventHash: 'b'.repeat(64), critic: { sha256: 'c'.repeat(64) }, verifier: { sha256: 'd'.repeat(64) } };
test('accepts a complete source-bound independent approval', () => assert.doesNotThrow(() => assertReviewAttestation(approval, digest)));
test('rejects missing, blocked, stale, or incomplete approvals', () => {
  for (const value of [null, { ...approval, status: 'BLOCKED' }, { ...approval, sourceDigest: 'e'.repeat(64) }, { ...approval, graphEventHash: null }, { ...approval, critic: null }, { ...approval, verifier: null }]) assert.throws(() => assertReviewAttestation(value, digest));
});
test('never approves unresolved critical or high findings', () => {
  assert.throws(() => assertReviewAttestation({ ...approval, unresolvedCritical: 1 }, digest));
  assert.throws(() => assertReviewAttestation({ ...approval, unresolvedHigh: 1 }, digest));
});
test('source digest catches code drift but ignores regenerated version metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'luma-review-test-'));
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    mkdirSync(join(root, 'src/generated'), { recursive: true });
    writeFileSync(join(root, 'src/app.ts'), 'export const answer = 1;');
    writeFileSync(join(root, 'src/generated/release-manifest.json'), '{}');
    const first = reviewedSourceDigest(root);
    writeFileSync(join(root, 'src/generated/release-manifest.json'), '{"gitSha":"metadata"}');
    assert.equal(reviewedSourceDigest(root), first);
    writeFileSync(join(root, 'src/app.ts'), 'export const answer = 2;');
    assert.notEqual(reviewedSourceDigest(root), first);
    symlinkSync('app.ts', join(root, 'src/link.ts'));
    assert.throws(() => reviewedSourceDigest(root), /Non-regular release input/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('absence of a Graph release approval blocks deployment', () => {
  const root = mkdtempSync(join(tmpdir(), 'luma-no-review-'));
  try { assert.throws(() => verifyReview(root)); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
