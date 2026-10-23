import { describe, expect, it } from 'vitest';
import { assertLivekitCloudProof } from './assert-livekit-cloud-proof.mjs';

const sha = 'a'.repeat(40);
const now = Date.parse('2026-10-21T20:30:00.000Z');
const expected = {
  sha, runId: '39559001111', attempt: '1', scenario: 'departed_learner',
  startedAtMs: now - 30_000,
};
function proof(patch = {}) {
  return {
    sourceSha: sha, cloudProjectId: 'p_5650huuc5om',
    qaRunId: expected.runId, qaRunAttempt: expected.attempt,
    qaRunNonce: expected.runId + '-' + expected.attempt + '-' + sha,
    checkedAt: new Date(now - 2_000).toISOString(),
    conclusion: 'PROVIDER_CLOUD_PASS',
    checks: Array.from({ length: 18 }, (_, i) => ({
      action: 'cloud-check-' + i, passed: true,
    })),
    ...patch,
  };
}
const inspect = (report = proof(), override = expected, modifiedAt = now - 2_000) =>
  assertLivekitCloudProof(report, override, modifiedAt, now);

describe('Cloud QA artifact provenance must fail closed', () => {
  it('accepts complete source-bound evidence generated in the current run only', () => {
    expect(inspect()).toMatchObject({
      conclusion: 'PROVIDER_CLOUD_PASS', runId: expected.runId, checksPassed: 18,
    });
  });
  it('rejects a historic PASS committed to the repository without run identity', () => {
    expect(() => inspect(proof({qaRunId:null,qaRunNonce:null})))
      .toThrow('QA_PROOF_RUN_OR_SOURCE_MISMATCH');
  });
  it('rejects a prior run, prior attempt and mismatched commit', () => {
    for (const fields of [
      {qaRunId:'39559001000'},
      {qaRunAttempt:'2'},
      {sourceSha:'b'.repeat(40)},
      {qaRunNonce:'different'},
    ]) {
      expect(() => inspect(proof(fields))).toThrow('QA_PROOF_RUN_OR_SOURCE_MISMATCH');
    }
  });
  it('rejects invalid timestamps and a stale file mtime', () => {
    expect(() => inspect(proof({checkedAt:'2026-10-20T19:00:00Z'})))
      .toThrow('QA_PROOF_STALE_OR_TIME_INVALID');
    expect(() => inspect(proof(), expected, now - 100_000))
      .toThrow('QA_PROOF_STALE_OR_TIME_INVALID');
  });
  it('rejects failed, missing or duplicated assertions even with conclusion PASS', () => {
    expect(() => inspect(proof({checks:[...proof().checks.slice(0,17),{action:'failed',passed:false}]})))
      .toThrow('QA_PROOF_ASSERTIONS_FAILED_OR_INCOMPLETE');
    expect(() => inspect(proof({checks:proof().checks.slice(0,17)})))
      .toThrow('QA_PROOF_ASSERTIONS_FAILED_OR_INCOMPLETE');
    expect(() => inspect(proof({checks:[...proof().checks.slice(0,17),proof().checks[0]]})))
      .toThrow('QA_PROOF_DUPLICATE_CHECKS');
  });
  it('rejects another Cloud project and misleading conclusion', () => {
    expect(() => inspect(proof({cloudProjectId:'different'})))
      .toThrow('QA_PROOF_RUN_OR_SOURCE_MISMATCH');
    expect(() => inspect(proof({conclusion:'FAIL'})))
      .toThrow('QA_PROOF_ASSERTIONS_FAILED_OR_INCOMPLETE');
  });
  it('enforces each scenario’s exact expected assertion coverage', () => {
    const smaller = proof({ checks: proof().checks.slice(0,13) });
    expect(inspect(smaller, {...expected,scenario:'project_policy'}).checksPassed).toBe(13);
    expect(() => inspect(smaller)).toThrow('QA_PROOF_ASSERTIONS_FAILED_OR_INCOMPLETE');
  });
});
