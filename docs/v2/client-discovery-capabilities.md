# LUMA V2 — Client Discovery Capability Map

## Purpose

This document turns the October client discovery conversation into bounded product capabilities and delivery gates. It is intentionally not a sales promise: a capability is marked production-ready only when its implementation, stateful tests, security review, operational prerequisites, and evidence gates are complete.

## 1. Commerce stays decoupled from learning

### Client need
The client can continue selling through Hotmart while LUMA serves the learning experience. A direct Stripe route may be added without forcing a migration from Hotmart.

### Product capability
```text
Hotmart / Stripe
      ↓ signed webhook
Provider adapter
      ↓ normalized CommerceEvent
ProviderEvent ledger
      ↓ product mapping
Entitlement
      ↓
Enrollment
      ↓ verified-email claim
LUMA learner identity
```

### Implemented
- Hotmart provider adapter with Hottok validation.
- Stripe provider adapter with raw-body HMAC webhook verification and replay-tolerance window.
- Durable ProviderEvent receipt before downstream processing.
- Configurable provider product → tenant/product/program mappings.
- Provider transaction bindings so refunds/cancellations can resolve an earlier purchase even if the later payload omits product/customer context.
- Delayed Stripe Checkout success is fulfilled from the asynchronous success webhook rather than the earlier unpaid Checkout event.
- Partial Stripe refunds are auditable but do not revoke the full learning entitlement.
- Entitlement lifecycle with stale-event protection.
- Hotmart subscription cancellation respects the already-paid access period (`date_next_charge`) and expires access by effective time; newer renewals supersede the scheduled expiry.
- Enrollment activation/revocation.
- Verified-email claim to bind commerce enrollment to Firebase learner identity.
- Live/hybrid enrollment is associated with a specific offering (`offeringId`); an enrollment without an offering assignment does not expose another cohort's private schedule.
- Admin-only product mapping endpoint.
- Provider webhook endpoints return `202` when an event is durably retained but awaits mapping/customer context.

### Production prerequisites
- Provision `HOTMART_HOTTOK` in Secret Manager/App Hosting.
- Provision `STRIPE_WEBHOOK_SECRET` in Secret Manager/App Hosting.
- Configure provider webhooks to the canonical LUMA endpoints.
- Populate product mappings before enabling a product.
- Run provider sandbox/test-mode end-to-end receipts before accepting real payments.

## 2. High-ticket live and low-cost asynchronous programs are different delivery modes

### Client need
High-ticket programs may be intentionally synchronous and camera-on. Low-cost / evergreen programs can be asynchronous. LUMA must not force recordings onto a live methodology.

### Product capability
Program offerings now declare:
- `asynchronous`
- `live`
- `hybrid`

Live/hybrid offerings can schedule sessions with timezone, duration, secure join URL, coach assignments, and a recording policy of:
- no recording;
- optional;
- available after the session.

Asynchronous offerings explicitly reject live-session scheduling, making delivery semantics part of the domain instead of an informal UI convention.

### Learner access
`GET /api/programs/my-schedule` derives the learner's active programs from commerce enrollment and returns only scheduled sessions for programs the learner can access.

## 3. Engagement becomes intervention intelligence, not nagging

### Client need
A recurring problem is purchase without completion. The client wants better retention and engagement without an intrusive Duolingo-style experience.

### Product capability
The intervention engine ranks a learner using persisted learning evidence:
- inactivity duration;
- average demonstrated mastery;
- completed capability ratio;
- repeated failed attempts.

The recommendation is intentionally conservative:
- **high:** human check-in before assigning more content;
- **medium:** contextual reminder plus one small next action;
- **low:** observe without unnecessary intervention.

The coach Studio consumes these signals through `/api/coach/interventions` and uses the persistent Learning Twin when available.

## 4. Content Intelligence turns accumulated expertise into a queryable corpus

### Client need
A learner or coach should be able to ask a question such as “where does the material discuss this idea?” and receive the exact video/source segment instead of manually searching hours of recordings.

### Product capability
The Library now has authenticated Content Intelligence search:
- text query;
- browser voice dictation when supported;
- grounded retrieval from the existing audiovisual RAG;
- source module/title;
- exact start/end timestamps;
- quoted recovered segment.

Private implementation locators such as internal transcript/SRT paths and raw storage URLs are not returned by the public API.

## 5. Digital Twin, coach and voice remain separate capabilities

The existing Learning Twin continues to own learning-state evidence and coach context. Commerce never writes mastery. Program attendance never certifies learning. Voice/TTS is optional and its outage must not discard a payment, entitlement, enrollment, or learning event.

This preserves the central invariant:

```text
Payment ≠ Entitlement ≠ Enrollment ≠ Attendance ≠ Mastery
```

## 6. Operational questions from discovery

The client asked about simultaneous users, number of programs, uptime, hosting, security, data control and commercial packaging. Those are legitimate enterprise acceptance criteria, not values that should be guessed from source code.

### What is true now
- Application APIs run server-side.
- Firestore client rules are deny-all; browser code cannot directly read/write persistence.
- Firebase Admin SDK is the server persistence boundary.
- Provider and RAG credentials are server secrets.
- `/api/health` provides a non-sensitive core health signal.
- App Hosting currently has a deliberately small pilot configuration: 1 CPU, 512 MiB, `maxInstances: 2`, `concurrency: 80`.

### What is not yet proven
- 100, 1,500, “unlimited”, or any other active-user tier is not a verified engineering capacity number yet.
- 99.9% is not yet an evidence-backed LUMA SLA.
- Regional failover is not demonstrated merely because the application runs on Google infrastructure.

Those claims require LUMA-062 capacity/resilience validation before the enterprise pilot gate can pass.

## 7. Commercial packaging remains independent of the architecture

Supported commercial shapes can include:
- Hotmart commerce + LUMA experience;
- Stripe direct commerce + LUMA experience;
- fixed SaaS fee;
- active-learner metering;
- enterprise/owned deployment with a separate operations model.

Provider fees and payout timing must remain provider/commercial data. They are deliberately not hard-coded into learning or entitlement logic.
