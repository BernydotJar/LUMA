# LUMA — Institutional Enrollment (non-payment admission)

## Business use
High-ticket programs often have scholarships, corporate seats, cohort invitations, offline settlements or contractual access separate from Hotmart/Stripe. LUMA now has an audited **institutional access grant**, distinct from a merchant purchase, to support these cases without creating a fake transaction.

## Contract

- `POST /api/enrollments/institutional`: active-cohort, exact tenant/program, verified administrator scope, email, reason (20-500 characters), explicit `expiresAt` (UTC ISO, future <=2 years). Returns `granted`, `extended`, `reactivated` or `unchanged`.
- `GET /api/enrollments/institutional?tenantId=...&limit=50&cursor=...`: private paginated status listing for authorized admins.
- `GET /api/enrollments/institutional/offerings?tenantId=...&cursor=...`: active cohorts in that organization.
- `POST /api/enrollments/institutional/{enrollmentId}`: immediate revocation, requiring tenant and justification in body.
- `/studio/enrollments`: administration console with expiring grants, renewal and explicit revocation.
- On first sign-in, `GET /api/commerce/access` (existing flow) claims a pending grant only after **Firebase verifies ownership of the same email**. No purchase is forged, no card details are handled.
- Once claimed, the existing scoped Learning Twin, tutor, session admission and certificate authorization use the identical `isActiveCommerceEnrollment` predicate. Revoke disables access on the next authorization; transactional writes re-read eligibility before mutating progress.

## Security and separation

- Only platform `superuser` (explicit claim/role) or `admin` **with a matching** `tenantId` / `tenantIds` / `adminTenantIds` custom claim can grant or revoke. An unscoped `admin=true` token **cannot** enroll anyone. Trainers and buyers cannot.
- Business data is validated against the current `programOfferings` record inside the same Firestore transaction. The offering must be active and have matching tenant/program.
- A deterministic SHA-256 record key over tenant, program, cohort and normalized email prevents duplicate grants. Active replays with identical expiry are idempotent; extension must increase expiry.
- Revoked grants need an explicit `allowReactivation=true` on regrant. Reasons, administrator UID, timestamps and revisions are retained in an append-only Firestore audit subcollection.
- `commerceEnrollments/{id}` includes `enrollmentSource: "institutional"` and `lastProvider: "institutional"`; **there is no commercial transaction or entitlement document**. The preexisting commerce webhook state machine is left intact.
- Firestore client rules deny direct reads/writes. User-facing APIs use verified Bearer ID tokens, server-side tenant authorization and `no-store`.
- In deployments with `LUMA_LEARNING_ACCESS_MODE=entitled`, `LUMA_LEARNING_TENANT_ID` must be configured server-side. An institutional grant alone does not change the deployment's access policy.

## Rollout and operations

1. Deploy `firestore.indexes.json` alongside rules; it adds the tenant+enrollmentSource index used by the console listing.
2. Assign the proper organization-specific custom claim to each admin and refresh their Firebase ID token. Do not make all tenant administrators superusers.
3. Create active program cohorts using the existing program delivery administration. Then grant access by email with an explicit expiry.
4. Confirm the invited person signs in using that exact email and gets a verified identity; test scheduled sessions, Learning Twin, practice and certificates.
5. Verify revocation during an active learning session; no subsequent authorized writes must commit after a refund or institutional revoke.
6. Back up Firestore, monitor admin actions, configure retention/deletion and incident response before production deployment. Avoid reporting grants as merchant sales in revenue analytics.

## Evidence and testing

Unit: `src/lib/commerce/institutional-grants.test.ts`. Firestore integration: `src/lib/commerce/institutional-grant.emulator.test.ts`; registered in the CI emulator job. Browser navigation: `e2e/showcase.spec.ts`. Full production readiness additionally needs Firebase identity E2E, role provisioning, tenant selection and a restoration drill.

### Shared tenant administration policy

The same tenant-bound admin authorization is enforced for **certificate issuer configuration, certificate revocation, issuing/approving certificates and the certificate coach-console list**. A plain `admin=true` claim without a tenant grant is not sufficient to control another institution's credentials; only explicit `superuser=true` has platform-wide authority. This cross-module hardening is verified by `src/lib/tenant-admin-access.test.ts`.

## Bulk institutional admissions (enterprise operations)

The admin console now also supports CSV/TSV and pasted email-column enrollment through the existing `/studio/enrollments` UI. The file stays in the admin's browser; the client extracts only the email column and sends JSON with the common institution, active cohort, reason, expiry and the optional explicit reactivation confirmation.

### Endpoint

`POST /api/enrollments/institutional/bulk` requires a verified admin Firebase ID token, matching tenant-scoped claims, `application/json`, a body of at most 32,768 bytes and **1–100 rows**. Each row uses the existing transactional `FirestoreInstitutionalGrantStore.grant` path; the endpoint bounds concurrent Firestore mutations to four. It does not write to provider entitlements or payment ledgers.

A response reports `requested`, `granted`, `extended`, `reactivated`, `unchanged`, `duplicate_input`, `invalid` and `rejected`. Row numbers refer to imported email records, not raw physical CSV line numbers. Invalid email/duplicate rows do not create records; other failures do not roll back successfully processed independent rows. Repeated requests with the same expiry are idempotent by enrollment ID and unchanged existing expiry.

### CSV support

UTF-8 files and pasted columns; optional header `email`, `correo`, `correo_electronico`, `email_address`; comma, semicolon or tab separators; quoted cells. If the file contains multiple columns, an email header is required. Maximum 100 records per request; larger cohorts must be uploaded in batches. The server never trusts client-side parsing or validation.

### Governance and verification

Each successful grant has its own actor UID, reason, expiry, tenant/program/cohort scope and immutable audit subcollection. Regranting a revoked enrollment needs `allowReactivation=true`. Test normal grants, stale/future dates, duplicate emails, partial failures, forged cross-tenant scope, revocation then deliberate reactivation, and signed-in email claim. Error messages must not include raw Firestore failures or provider secrets. No invitation emails are sent by this endpoint; identity claim happens on normal Firebase login.
