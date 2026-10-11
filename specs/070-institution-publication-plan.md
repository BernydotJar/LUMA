# GRUV-002C — Controlled institutional publication plan (nonactivating)

**Status:** source-only candidate. This capability creates reviewable **publication plans**, NOT published institutions. Existing GRUV-001/002A/002B gates remain blocked. GRUV-002 activation is still pending, even if local plan tests pass.

## Outcome from the Product Owner

As the LUMA platform operator, I want to prepare a candidate configuration based on a documented readiness snapshot, have it reviewed by a second authorized administrator, and withdraw that review if evidence changes, while preserving append-only receipts and an auditable revision history. This supports safer onboarding across multiple tenants without impacting the current Seres de Excelencia deployment.

## Allowed state machine

`NONE --prepare--> prepared --review_by_different_UID--> reviewed --withdraw--> withdrawn --prepare_new_revision--> prepared`

A plan can also be withdrawn directly from `prepared`. Review does **not** mean published, enabled, released, approved by a compliance officer or deployed. `activationAllowed` remains **false** and no `getByTenantId` learning configuration interface is implemented. A reviewer must be a different Firebase UID from the preparer, and both must possess revoked-token-verified platform superuser authority at action time. A review transaction must recheck BOTH the draft version and the plan digest against the preflight inspected by the reviewer (not merely the plan revision).

## Execution contract

1. All API routes under `/api/platform/institutions/{tenantId}/publication-plan` default to `503 feature_unavailable` unless the **server-only** flag `LUMA_INSTITUTION_PLAN_ADMIN_ENABLED=true` is set. This flag is NOT added to App Hosting. Never trust tenant or role headers.
2. `GET` returns only a validated plan for an authenticated platform superuser. `POST` prepares and `PATCH` reviews or withdraws; **no route publishes to active runtime configuration**.
3. `POST` payload is exactly `requestId`, `expectedDraftVersion`, `expectedReadinessDigest` and `expectedPlanRevision`. Server inspects the current read-only preflight, requires all local checks true and exact digest/version match, and does not accept a client-supplied preflight object or compliance checkbox. A fail-closed transaction rechecks draft tenant/version before staging. This is NOT an atomic snapshot of program offerings; real publication must redo validation atomically.
4. Stored document: `institutionPublicationPlans/{sha256(tenantId)}`. Every mutation runs one Firestore transaction with reads of request receipt + plan, plus draft for prepare/review, BEFORE writes; compare-and-swap `planRevision` prevents lost updates. Receipt in `/audit/{sha256(requestId)}` and historical immutable `/revisions/{revision}` record every accepted transition. Strict schema checked on reads; foreign tenant data must fail closed.
5. Exact request/actor/action/payload replay is idempotent and returns its prior receipt. Reuse with a changed actor/action/payload is `REQUEST_REUSE_CONFLICT` (HTTP 409). All request IDs are high-entropy 16–128 allowed characters. Stored audit uses actor UID and enumerated reason codes, never bearer tokens or learner PII.
6. `PATCH action=review` is only from `prepared`; reviewer UID must differ from `preparedBy`; reason `reviewed-for-next-gate`. `PATCH action=withdraw` is from `prepared` or `reviewed` and allows authorized emergency withdrawal with `security-stop|evidence-stale|operator-withdrawn` reason. Once withdrawn, older reviewer receipts can be replayed for the historical result but NEVER reactivate the plan.
7. A new prepare from `withdrawn` requires current trusted preflight, exact draft version/digest, new request ID and expected current plan revision. Previous snapshots/receipts remain immutable.
8. Replay/returns never grant an entitlement; plan API cannot read or write `institutionConfigs`, `commerceEnrollments`, runtime tenant config, certificates or Seres learning materials.

## Acceptance criteria

- AC-01: Default flag off returns 503 for every method; no mutation endpoint exists for active publication.
- AC-02: Revocation-checked Firebase platform superuser required for all actions. Tenant-admin with `adminTenantIds`, coach/learner and anonymous callers denied.
- AC-03: A valid preflight produces a `prepared` plan, revision 1, `activationAllowed=false`, one atomic receipt and immutable revision record; no active config created.
- AC-04: Self-review denied; distinct authorized reviewer moves revision 1 to `reviewed` revision 2 without enabling any tenant.
- AC-05: Review with stale expected revision, concurrent review and invalid reused requestId fail closed; exact retry returns same prior revision without duplicate receipt.
- AC-06: `withdraw` works from prepared and reviewed, leaves history/receipts intact, creates rev 3 and keeps `activationAllowed=false`; second `prepare` after withdrawal creates rev 4 without erasing rev 1–3.
- AC-07: A changed draft version or readiness digest blocks new prepare; a second tenant cannot read or overwrite a foreign plan. Corrupt stored fields return safe 503, not fallback to Seres.
- AC-08: Invalid request bodies/unknown fields, oversized requests and invalid reason/action/status are rejected; data-store outages are 503, not 200.
- AC-09: Full unit, Auth+Firestore emulators, TypeScript, lint, build, Chromium/mobile regression, adversarial critique and Graph evidence. **CI remote and IAM production signoff are independently required before release.**

## DDIA trade-offs

Firestore serializable transactions for the plan head, receipt and version ensure linearizable transitions for each tenant plan; event replay and idempotent receipts protect retries. No cross-resource atomicity with asynchronous `programOfferings` exists: the preflight digest is advisory and does not authorize production publication. Keep a modular monolith and small bounded domain state machine instead of adding a broker or microservices before load and operational evidence justify them.
