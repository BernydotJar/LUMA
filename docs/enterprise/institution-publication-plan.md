# LUMA / GRUV — Controlled publication planning runbook

**This is an internal, nonactivating source capability.** GRUV-002C stages and dual-reviews plan metadata while real tenant activation, config publishing and app access remain impossible via this API.

## Operator flow

1. A trusted platform superuser obtains a read-only preflight for a draft via `GET /api/platform/institutions/{tenantId}/publication-preflight`, with the preflight endpoint enabled only in an authorized isolated environment.
2. `POST /api/platform/institutions/{tenantId}/publication-plan` accepts only the current preflight `inspectionDigest`, `configVersion`, a high-entropy `requestId` and `expectedPlanRevision=0` (or the current revision when replacing a withdrawn plan).
3. The server re-runs the preflight, rejects blocked local checks, compares exact digest and draft version, and uses one Firestore transaction to stage a **prepared** plan. The authenticated platform user becomes the preparer.
4. A **different** authenticated platform superuser uses `PATCH action=review`, `expectedPlanRevision`, new `requestId` and `reasonCode=reviewed-for-next-gate`. This moves the plan to **reviewed**, NOT published.
5. An authorized superuser can use `PATCH action=withdraw` with enum reason `security-stop`, `evidence-stale` or `operator-withdrawn`. It creates a new immutable version and cannot remove the old audit entries. A later plan must be freshly prepared using current evidence.

## Stored records and protection

The implementation uses `institutionPublicationPlans/{sha256(tenantId)}` with `/audit/{sha256(requestId)}` and `/revisions/{planRevision}` for atomic, immutable history. Every transition has a deterministic idempotency receipt, expected revision token and actor provenance. The Firestore Admin SDK does not rely on client rules; independent IAM and service account reviews remain mandatory for managed production use.

The `GET` response is safe and stripped of source data content. It returns plan state, tenant, plan revision, draft config version, readiness digest, prepared/reviewed/withdrawn by UID, timestamps and `activationAllowed=false`. No course text, coach names, private class URLs or student records are returned.

## Release, rollback, and incident management

The `withdraw` method revokes **a reviewable publication plan**, not a previously activated institution. It is not a promise of production rollback. A real active-tenant rollback must be a separate future release protocol covering previously signed active versions, actual entitlement revocation, course access, RAG propagation, cache invalidation, audit and recovery.

No `LUMA_INSTITUTION_PLAN_ADMIN_ENABLED` flag is provisioned in `apphosting.yaml`; the value defaults to false. Nothing in the source should alter `LUMA_LEARNING_ACCESS_MODE`, tenant membership, Firebase custom claims, billing, published configs or Seres branding.

## Independent approval gate

Approval is explicitly **dual authority inside the software**, not merely a reviewer checkbox. The preparer cannot review their own plan; the reviewer must independently hold platform-superuser authority at action time. Both user identities are source-of-truth Firebase UID tokens with revocation checks. This is not a substitute for legal, compliance, infrastructure, product and customer release signoffs.

## Limitations to preserve

The current preflight is an as-of non-transactional read across program offerings; Firestore plan transaction rechecks draft version but does not atomically lock course status. Therefore successful plan staging is not proof that all active offerings remain unchanged before the real publication date. The future live publish gate must perform a bounded transactional revalidation and verify the exact upstream approvals and managed service configuration.
