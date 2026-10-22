/**
 * This is a *provenance* check, not a broad product acceptance verdict.
 * It must not accept the historic PASS reports committed for traceability.
 * Binding to commit + GitHub run + attempt + nonce + start time makes replay
 * or accidental reuse of an earlier artifact a fail-closed result.
 */
import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const expectedChecks = { departed_learner: 18, project_policy: 13 };
const approvedProject = 'p_5650huuc5om';

export function assertLivekitCloudProof(report, expected, fileMtimeMs, nowMs = Date.now()) {
  if (!expected || !Object.hasOwn(expectedChecks, expected.scenario)) {
    throw new Error('QA_PROOF_SCENARIO_INVALID');
  }
  if (!/^[0-9a-f]{40}$/.test(expected.sha ?? '') ||
      !/^[0-9]+$/.test(expected.runId ?? '') ||
      !/^[1-9][0-9]*$/.test(expected.attempt ?? '') ||
      !Number.isFinite(expected.startedAtMs)) {
    throw new Error('QA_PROOF_EXPECTATION_INVALID');
  }
  const nonce = [expected.runId, expected.attempt, expected.sha].join('-');
  if (!report || report.cloudProjectId !== approvedProject ||
      report.sourceSha !== expected.sha ||
      report.qaRunId !== expected.runId ||
      report.qaRunAttempt !== expected.attempt ||
      report.qaRunNonce !== nonce) {
    throw new Error('QA_PROOF_RUN_OR_SOURCE_MISMATCH');
  }
  const finishedAt = Date.parse(report.checkedAt);
  if (!Number.isFinite(finishedAt) ||
      finishedAt < expected.startedAtMs ||
      finishedAt > nowMs + 10_000 ||
      fileMtimeMs < expected.startedAtMs - 1000) {
    throw new Error('QA_PROOF_STALE_OR_TIME_INVALID');
  }
  if (report.conclusion !== 'PROVIDER_CLOUD_PASS' ||
      !Array.isArray(report.checks) ||
      report.checks.length !== expectedChecks[expected.scenario] ||
      report.checks.some((check) => !check || check.passed !== true ||
        typeof check.action !== 'string' || check.action.length === 0)) {
    throw new Error('QA_PROOF_ASSERTIONS_FAILED_OR_INCOMPLETE');
  }
  const uniqueChecks = new Set(report.checks.map((c) => c.action + ':' + (c.role ?? '')));
  if (uniqueChecks.size !== report.checks.length) {
    throw new Error('QA_PROOF_DUPLICATE_CHECKS');
  }
  return { scenario: expected.scenario, projectId: approvedProject,
    sourceSha: expected.sha, runId: expected.runId, attempt: expected.attempt,
    checksPassed: report.checks.length, conclusion: report.conclusion };
}

export function verifyCloudProofFile(file, expected, secrets, nowMs = Date.now()) {
  const body = readFileSync(file, 'utf8');
  for (const secret of secrets) {
    if (secret && body.includes(secret)) throw new Error('QA_PROOF_SECRET_FOUND');
  }
  if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/.test(body)) {
    throw new Error('QA_PROOF_JWT_FOUND');
  }
  const report = JSON.parse(body);
  return assertLivekitCloudProof(report, expected, statSync(file).mtimeMs, nowMs);
}

// Called only by the trusted GitHub workflow, never by PR/untrusted code with secrets.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) throw new Error('QA_PROOF_REPORT_PATH_REQUIRED');
  const e = process.env;
  const result = verifyCloudProofFile(file, {
    sha: e.GITHUB_SHA,
    runId: e.GITHUB_RUN_ID,
    attempt: e.GITHUB_RUN_ATTEMPT,
    scenario: e.QA_SCENARIO,
    startedAtMs: Date.parse(e.LUMA_QA_STARTED_AT ?? ''),
  }, [e.LIVEKIT_CLOUD_TEST_API_KEY, e.LIVEKIT_CLOUD_TEST_API_SECRET]);
  console.log('FRESH_CLOUD_QA_PROOF_VERIFIED ' + JSON.stringify(result));
}
