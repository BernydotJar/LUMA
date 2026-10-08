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

## LUMA-052 — Provider Event Ledger + Entitlement Lifecycle
The provider-event ledger is intentionally split into receipt and processing phases:

```text
provider webhook
   ↓
normalized commerce event
   ↓
receive(event)       -> durable provider-event record
   ↓
resolve tenant/customer/product
   ↓
process(event)       -> entitlement mutation in a Firestore transaction
```

This means an acknowledged payment event can remain durably visible even if product mapping, entitlement processing, AI, voice, or another downstream capability is temporarily unavailable.

### Replay and conflict rules
- The idempotency identity is `provider + externalEventId`, encoded as an unambiguous serialized tuple before hashing so delimiter-bearing provider/event IDs cannot collide.
- A byte-for-byte provider payload is not required for replay, but the normalized semantic identity must remain stable: provider, event id, type, provider timestamp, customer id, product id, and transaction id.
- Reusing an event id with conflicting normalized semantics is rejected as `COMMERCE_EVENT_CONFLICT`.
- Optional provider IDs are trimmed and empty values normalize to absent, preventing replay mismatches caused by empty strings.
- A processed event is never applied to Entitlement twice.
- A failed or received event remains retryable.

### Ordering rules
Entitlement state is ordered by provider event time, not delivery time. RFC3339 provider timestamps are compared with their full declared fractional precision up to nanoseconds; higher precision is rejected rather than silently truncated.

- A later refund/revocation cannot be undone by an older delayed payment event.
- If grant and revoke have the same provider timestamp, revoke wins.
- A newer legitimate grant/renewal may reactivate a previously revoked entitlement.
- Refund/revocation can create a revocation tombstone before the original grant arrives.

### Tenant isolation
Provider events are globally idempotent per provider event id. Entitlements are stored under a tenant-scoped Firestore document tree. Tenant/customer/product identities are normalized, serialized as an unambiguous JSON tuple, then hashed into deterministic document ids; delimiter-bearing IDs cannot collide. Firestore client rules remain deny-all; commerce mutation is a server-side capability.

### Observability
Each provider event records:
- correlation id;
- received / failed / processed state;
- processing attempts;
- sanitized failure code;
- processing outcome;
- resolved tenant/customer/product;
- resulting entitlement id.

This provides the basis for answering: “Why does this learner/customer have access?”

## Deliberately deferred
- Checkout UI.
- Customer-specific pricing.
- Hard-coded Hotmart fees.
- Provider signature verification until HotmartProvider / StripeProvider nodes.
- Production webhook endpoints until signature/auth contracts are implemented and adversarially verified.
- Enrollment persistence/activation until the entitlement-to-enrollment orchestration slice; Payment remains distinct from Enrollment.
