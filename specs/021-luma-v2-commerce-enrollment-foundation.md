# LUMA V2 — Commerce / Enrollment Foundation

## Decision
LUMA V2 is independent of the commerce channel. Hotmart remains a valid acquisition/payment route; Stripe can enable direct commerce later. Both converge into the same identity, entitlement, enrollment, Learning Twin, AI Coach, and Coach Intelligence domains.

## Invariants
- Provider payloads stop at the adapter boundary.
- Payment is not Enrollment.
- Entitlement is the authorization bridge between commerce and learning.
- Provider events are idempotent by provider + externalEventId.
- Commerce failure must not corrupt learning state.
- AI/voice outages must not discard a confirmed commerce event.
- No customer-specific branching in the learning domain.

## Initial V2 slice
1. Provider-neutral normalized commerce events.
2. Provider contract for webhook normalization.
3. Entitlement and enrollment command contracts.
4. Idempotency key derivation.
5. Hotmart and Stripe adapters remain subsequent gated nodes.

## Deliberately deferred
- Checkout UI.
- Customer-specific pricing.
- Hard-coded Hotmart fees.
- Production webhook endpoints until signature/auth contracts are implemented and adversarially verified.
