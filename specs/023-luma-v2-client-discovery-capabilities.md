# LUMA V2 — Client Discovery Capabilities

## Goal

Translate the October client discovery into product capabilities while preserving the existing LUMA learning-intelligence architecture.

## Business constraints

1. Hotmart may remain the initial commercial/payment channel.
2. Stripe is an additional direct-commerce route, not a learning-domain dependency.
3. High-ticket programs may remain live/synchronous by design.
4. Low-cost and evergreen products may be asynchronous.
5. Enrollment and program access must be automated after a valid commerce event.
6. Engagement must improve follow-through without intrusive notification patterns.
7. Content Intelligence must let users find expert knowledge by concept/question and return exact source timestamps.
8. Learning Twin, voice and coach intelligence remain available but cannot be authoritative for payment/access state.
9. Capacity, uptime and data guarantees require evidence rather than inferred cloud claims.

## Domain invariants

```text
Payment
  != Entitlement
  != Enrollment
  != Attendance
  != Learning Evidence
  != Mastery
```

- Provider payloads terminate at provider adapters.
- Provider events are durably received before dependent business processing.
- Provider retries are idempotent.
- Refund/cancellation must be able to resolve the original entitlement using durable transaction bindings.
- Product mappings are configuration, not provider-specific branches in the learning domain.
- A learner may claim an active commerce enrollment only through a verified identity.
- Live delivery does not imply recording.
- Engagement signals recommend intervention; they do not auto-message or penalize a learner.
- Content search exposes source/citation metadata but not private storage/transcript locators.
- AI/RAG/voice outages cannot destroy commerce or learning state.

## Implemented capability slices

### LUMA-053 — Hotmart Provider
- Hottok-authenticated V2 webhook adapter.
- Normalized purchase/refund/subscription lifecycle.
- Provider event identity and metadata normalization.

### LUMA-054 — Stripe Provider
- Raw-body signed webhook verification.
- Timestamp tolerance.
- Payment/subscription/refund normalization.

### LUMA-057 — Commerce to Enrollment Activation
- Product mapping store.
- Provider transaction binding store.
- Entitlement policy.
- Enrollment activation/revocation.
- Verified-email learner claim.
- Admin mapping endpoint.
- Provider webhook endpoint.
- Pending/retry semantics for incomplete mapping/customer context.

### LUMA-058 — Live Program Delivery
- asynchronous/live/hybrid offerings;
- cohort identity;
- timezone;
- coach assignments;
- scheduled sessions;
- secure join URLs;
- explicit recording policy;
- learner schedule endpoint and UI.

### LUMA-059 — Engagement Intervention Runtime
- inactivity;
- demonstrated mastery;
- completion evidence;
- repeated attempts/failures;
- low/medium/high intervention priority;
- conservative andragogy-aligned recommendations;
- coach Studio integration.

### LUMA-060 — Content Intelligence Search
- authenticated search API;
- grounded audiovisual retrieval;
- exact timestamps;
- browser voice dictation input;
- sanitized learner-facing results.

### LUMA-061 — Platform Operability Contract
- core health probe;
- server-only persistence boundary;
- provider setup runbook;
- explicit distinction between current pilot runtime and evidence-backed capacity/SLA.

## Deferred release evidence

### LUMA-062 — Capacity / Resilience Validation
Must produce:
- target-tier load test;
- soak test;
- p50/p95/p99 latency and error rate;
- webhook burst/replay tests;
- dependency outage tests;
- backup/restore evidence;
- rollback evidence;
- monitoring/SLO evidence;
- cost profile.

### LUMA-055 — Enterprise Pilot Gate
May pass only after LUMA-062 and its release-quality evidence are complete.

## Current acceptance tests

- provider adapter unit tests;
- commerce policy tests;
- engagement tests;
- Firestore ProviderEvent ledger tests;
- Firestore commerce-orchestration tests;
- Firestore live-program tests;
- Firestore Learning Twin persistence tests;
- product lint/typecheck/build;
- production dependency audit;
- Playwright product regression;
- independent code/security review before promotion.
