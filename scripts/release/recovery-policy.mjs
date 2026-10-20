/** No production rollback is ever needed when this release never promoted traffic. */
export function promotionStarted(ledger) {
  if (!ledger || !Array.isArray(ledger.events)) {
    throw new Error('Recovery evidence is missing or corrupt');
  }
  return ledger.events.some(event => event?.phase === 'PROMOTION_STARTED');
}
