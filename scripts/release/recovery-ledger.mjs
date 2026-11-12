import { invariant } from './policy.mjs';

/** A copied artifact never authorizes rollback without exact-run provenance. */
export function validatePreparedLedger(ledger,manifest,attempt){
  invariant(/^[0-9]+$/.test(String(attempt||'')), 'Invalid workflow attempt');
  const candidate=['gh',manifest.gitSha.slice(0,12),manifest.runId,attempt].join('-');
  invariant(ledger?.gitSha===manifest.gitSha &&
    ledger?.runId===manifest.runId &&
    ledger?.buildId===candidate &&
    ledger?.previous?.buildId && ledger.previous.buildId!==candidate,
    'Prepared recovery ledger is for another source/run/build');
  const phases=(ledger.events||[]).map(x=>x.phase);
  invariant(phases.includes('PREFLIGHT_PASSED') && phases.includes('BUILD_READY'),
    'Ledger does not contain a completed recovery preflight and READY build');
  invariant(ledger.previous.knownGood===true &&
    /^[a-f0-9]{40}$/.test(ledger.previous.gitSha||''),
    'Unverified rollback baseline is not authorized');
  return candidate;
}

export function validatePromotableLedger(ledger,manifest,attempt){
  const candidate=validatePreparedLedger(ledger,manifest,attempt);
  invariant(ledger.status==='READY_FOR_PROMOTION' &&
    ledger.events.at(-1)?.phase==='BUILD_READY',
    'Ledger is not the prepared, unpromoted revision');
  return candidate;
}
