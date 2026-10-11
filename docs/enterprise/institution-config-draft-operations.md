# LUMA Institutional Draft Control Plane — Operator Runbook

**Status: proposed source implementation / disabled by default.** This file is a runbook for safely evaluating draft functionality, not an instruction to turn on a public SaaS.

## Architecture

Firebase verified administrator -> revoked-token verification -> dedicated `adminTenantIds` authority (no legacy tenant fallback) -> draft API (opt-in internal flag) -> Firestore transaction -> versioned draft + immutable audit receipt.

A learning request still follows its independent purchased or institutional entitlement. A draft cannot be consumed as an active institution configuration, cannot create a learner, and does not confer access to PNL material.

## API intended for isolated verification

`GET /api/platform/institutions/{tenantId}/draft` is scoped to tenant admin and returns either a draft or explicit not-found.

`POST /api/platform/institutions/{tenantId}/draft` is platform-superuser only and requires an allowlisted neutral LUMA or GRUV template (never a copy of the Seres brand), list of program IDs, `requestId`, `reasonCode: "institution-onboarding"` and `expectedVersion: 0`.

`PATCH /api/platform/institutions/{tenantId}/draft` is tenant-admin scoped. It requires `expectedVersion`, `requestId`, `reasonCode` (`brand-update` or `brand-correction`) and a **complete replacement brand** object. It cannot change product template, program IDs or feature flags.

All endpoints require `Authorization: Bearer <Firebase ID Token>`. Requests and responses must not be cached, and request bodies and input fields are bounded. Only the server recognizes `LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED=true`. Never pass this flag through `NEXT_PUBLIC_*` or set it in production for a source-only experiment.

## Data and consistency

Collection: `institutionConfigDrafts`. Document ID: `sha256(tenantId)`. Subcollection `audit` uses a deterministic hash of each unique, high-entropy `requestId`. The transaction reads draft and audit before creating the new revision. A same-request replay returns a duplicate receipt; a request ID collision with different actor/payload is rejected. A stale expected version must not silently overwrite current configuration. All `updatedAt`/audit times use validated ISO UTC timestamps; **configVersion**, not clock ordering, is the consistency authority (distributed clocks may differ).

Idempotency is exactly scoped to each tenant's draft document. Atomic document + audit writes are guaranteed by one Firestore transaction. Outside the transaction, downstream messaging would require an outbox/reconciliation design; no mailing, provisioning or billing event is emitted in this slice.

## Security and operational gates

- Do not attach learner evidence or private course content to drafts or audit metadata.
- Validate program identifiers and template combinations, and confirm ownership/existence as a future **publication** gate.
- Read only with server-owned Admin SDK; `firestore.rules` deny Firebase client SDK read/write by default.
- Emulators must use `demo-*` project IDs and loopback endpoints. No personal/admin production accounts should be created by automated tests.
- Missing draft, conflict, invalid request, denial and backend failure must have distinguishable status codes, correlation IDs where appropriate, and safe error responses.
- The brand logo source is limited to vetted bundled `/brand/` assets. User-provided image uploads and external resource URLs require a separately reviewed asset pipeline.
- Keep creation platform-superuser-only until organization ownership and contractual authorization are verified.
- The first deployment of the feature requires a separate production security decision and a reversible rollout/monitoring plan. Do not enable merely because CI is green.

## DDIA-inspired design trade-offs

| Decision | Benefit | Accepted limitation |
| --- | --- | --- |
| Firestore document and transaction | Atomic draft/CAS/audit; reuse current stack | Document writes can contend; measure before scaling |
| Deterministic request receipts | Idempotent retry and auditable history | Client must keep request ID stable across retries |
| Strong concurrency for config changes | Avoid lost updates | Caller must resolve 409 conflict and refresh |
| No message broker | Smaller ops surface and fewer failure points | Future publication/outbox is a distinct product gate |
| Draft separate from published state | Keeps existing SE experience unaffected | No dynamic institution activation yet |

This design is shaped by the **user-provided summary/transcript** of *Designing Data-Intensive Applications*: reliability, scalable data access, maintainability, cautious distributed failure handling and versioned event history. We did not use the complete book text as a source.
