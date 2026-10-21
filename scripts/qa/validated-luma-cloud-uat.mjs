/** Pure, fail-closed admission of one authenticated LUMA + LiveKit Cloud test receipt.
 * Historical checked-in JSON is never an authorization for the current QA run. */
export function validateAuthenticatedCloudUatReceipt({
  report, expectedSourceSha, runStartedAtMs, reportMtimeMs, childExitCode,
}) {
  function requireCondition(condition, code) {
    if (!condition) throw new Error(code);
  }
  requireCondition(/^[a-f0-9]{40}$/.test(expectedSourceSha ?? ''),
    'QA_EXPECTED_SOURCE_INVALID');
  requireCondition(childExitCode === 0, 'QA_CHILD_FAILED');
  requireCondition(report && typeof report === 'object', 'QA_REPORT_MISSING');
  requireCondition(report.qaSourceSha === expectedSourceSha, 'QA_SOURCE_SHA_MISMATCH');
  requireCondition(Number.isFinite(runStartedAtMs) &&
    Number.isFinite(reportMtimeMs) && reportMtimeMs >= runStartedAtMs - 1000,
    'QA_REPORT_STALE');
  const reportStarted = Date.parse(report.startedAt ?? '');
  requireCondition(Number.isFinite(reportStarted) &&
    reportStarted >= runStartedAtMs - 1000,
    'QA_REPORT_STARTED_BEFORE_THIS_RUN');
  requireCondition(report.overall === 'PASS_AUTHENTICATED_LUMA_CLOUD_E2E' &&
    report.cloudAcceptance === 'PROVIDER_AND_APP_CLOUD_PASS',
    'QA_NOT_COMPLETE');
  requireCondition(Array.isArray(report.results) && report.results.length >= 36 &&
    report.results.every(item => typeof item.name === 'string' &&
      item.name.length > 0 && item.result === 'PASS'),
    'QA_REQUIRED_ACTIONS_MISSING_OR_FAILED');
  requireCondition(new Set(report.results.map(item => item.name)).size ===
    report.results.length, 'QA_DUPLICATE_ACTION_NAMES');
  requireCondition(report.passCount === report.results.length &&
    report.failCount === 0 && report.blockedCount === 0,
    'QA_COUNTS_NOT_CONSISTENT');
  return { sourceSha: expectedSourceSha, overall: report.overall,
    pass: report.passCount, fail: 0, blocked: 0 };
}
