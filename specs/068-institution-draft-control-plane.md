# LUMA-GRUV-002A — Auditable, disabled-by-default institution draft control plane

**Product state:** implementation candidate, NOT authorization to enable a public SaaS, modify a real tenant, or deploy an institution configuration backend.

## Story

As a LUMA platform operator, I want to prepare an institutional experience in an isolated and version-controlled **draft** so that the Seres de Excelencia experience remains unchanged while future institution onboarding becomes repeatable, reviewable and reversible.

As an existing tenant administrator, I want to edit the visual identity **of my own draft only**, with traceable confirmation and concurrent-edit protection, so that no choice in the branding editor can change learner access, commercial entitlements, or another institution.

## Premises

- GRUV-001 produced source-level `InstitutionConfig` and two product templates, but the Graph release gates are blocked and the enterprise tenant-control-plane node is still dependent on those gates.
- The existing Firebase authorization contract is `requireLearningAdmin(request)` (revoked token checked) followed by **strict** `assertInstitutionDraftAdmin(claims, tenantId)` requiring dedicated `adminTenantIds`, or `isPlatformSuperuser` for a new tenant draft. Legacy learner/coach tenant claims do not grant draft administration.
- The production `LUMA_LEARNING_ACCESS_MODE=entitled` path is not dynamically multi-tenant; brand editor data must **never** authorize an entitlement.
- Firestore client rules deny direct reads/writes; only the trusted Admin SDK may access drafts.

## Contract

1. Firestore path `institutionConfigDrafts/{sha256(tenantId)}` stores an immutable-compatible, versioned *draft* document. The raw tenant ID is validated and rechecked against the document value before returning data.
2. Creation uses an **allowlisted template name** (`luma-platform` or `gruv-languages`; Seres branding is prohibited for new tenant onboarding) and an explicit tenant ID / program ID list. No body-provided arbitrary fields. Only the authenticated platform superuser may create the draft.
3. An existing tenant administrator may update **only the brand**, preserving `tenantId`, `programIds`, `shellId`, `domain`, framework ID, feature policy and lifecycle. No field patch can enable voice, commerce or certificates.
4. Every write is one Firestore transaction: read the record and request receipt, verify expected `configVersion`, write next draft, create immutable audit receipt under `institutionConfigDrafts/{hash}/audit/{hash(requestId)}`. Do not write audit PII or tokens.
5. Idempotency: retries of the exact same command + actor return the recorded version without adding audit entries; reused `requestId` with changed payload/actor is a hard conflict. Distinct concurrent writes with stale `expectedVersion` return a conflict and never overwrite the latest version.
6. Reads for administration are scoped to a **revocation-checked** authorized tenant admin. A missing draft returns explicit 404, not the Seres template. Backend outages return 503; never convert failures into empty states.
7. The canonical `InstitutionConfigStore.getByTenantId` used by learning experience resolution must return **null** for a draft. A draft is never a published/active learning configuration.
8. The API is disabled unless the server-only `LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED=true`. Default for missing/other values is **503 feature_unavailable**; no startup fallback. No change to current Firebase/App Hosting settings.
9. All JSON inputs must be allowlisted, bounded in size, and evaluated only after an authorized caller is identified. Responses include `cache-control: no-store` and no sensitive claims.

## Acceptance scenarios

- **AC-01:** Fresh platform-superuser creates tenant A draft with version 1, only for an allowlisted template; unauthorized or tenant-scoped admin cannot create.
- **AC-02:** Tenant-A admin reads and updates its own brand; tenant-B admin cannot read or write tenant A, including mismatched stored tenant identity.
- **AC-03:** A tenant-A admin cannot change tenant/program, shell, features, framework or active entitlement through a brand request, even with extra JSON keys.
- **AC-04:** Two administrators updating the same expected version produce exactly one successful increment and one `VERSION_CONFLICT`.
- **AC-05:** Exact retry is idempotent (same resulting version and a single audit receipt); replay of `requestId` with different payload or actor is rejected.
- **AC-06:** Firestore errors remain 503 and do not trigger a global or SE fallback.
- **AC-07:** Production-disconnected/read-for-learning path does not return draft configurations, even if the draft exists.
- **AC-08:** Unit + actual Firestore emulator + revoked-ID-token boundary + TypeScript + lint + prod build + targeted browsers run with explicit results. Emulator proofs do NOT assert cloud production authorization.
- **AC-09:** Request parsing rejects unexpected fields, oversized bodies, weak identifiers, invalid branding links, unsupported template identifiers and long/free-form reason fields.

## Deferred release conditions

The first slice may remain local/PR-only. Real multi-tenant SaaS activation requires an approved/verified GRUV-001 source gate; IAM tenancy control plane; runtime migration/feature flags; real provider-scoped RAG; data processing terms; backup/recovery and cost/traffic evidence; approved commercial policies; proper independent human/security review.

## Graph gates

Source development is in graph node `LUMA-GRUV-002A-institution-draft-persistence` independent of blocked activation nodes. The larger `LUMA-GRUV-002-trusted-tenant-control-plane` remains `pending` and depends on GRUV-001 plus GRUV-002A. Do not fabricate a `done` status for either node.
