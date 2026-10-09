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
