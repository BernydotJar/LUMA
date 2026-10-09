# LUMA — Academic program operations

This increment completes the **administrator-facing operational path** for institutional cohorts and scheduled classes. It reuses the existing program delivery data model and LiveKit integration; it does not introduce a separate LMS or fake live sessions.

## User journeys

1. An authorized admin signs into `/studio/programs`, selects a tenant explicitly authorized by token claims, creates a cohort draft with `programId`, `cohortKey`, title, IANA timezone, delivery mode and coach UIDs.
2. The admin activates the cohort via the existing `upsertOffering` transaction. Program IDs and cohort keys remain deterministic (SHA-256 stable identity), so updating the same offering does not generate duplicate enrollments.
3. Eligible learners enter via Hotmart, Stripe or the institutional enrollment flow in `/studio/enrollments` (email ownership verified at first login).
4. The admin schedules a `livekit` class (no external link) or an `external` HTTPS class, with explicit duration, capacity and recording policy. The session is stored under the offering.
5. Learners consult their assigned schedule and join live classes via existing LUMA admission/entitlement authorization. Coaches view attendance and learning evidence in existing modules.

## API behavior

- `GET /api/programs/admin/offerings?tenantId=...&limit=50&cursor=...` tenant-scoped list, pagination using Firestore document IDs.
- `POST /api/programs/admin/offerings` creates/updates an offering only when admin tenant scope matches `tenantId`. New offerings default to **draft**.
- `GET /api/programs/admin/offerings/{offeringId}/sessions` requires admin authentication and re-reads the exact stored offering tenant before listing sessions.
- `POST /api/programs/admin/offerings/{offeringId}/sessions` requires tenant authorization, valid active/draft offering, session date in future, 10–720 minutes, capacity 2–1000 and approved recording policy. `livekit` forbids external join URLs; `external` join links must use HTTPS.
- The user-facing `datetime-local` input represents the administrator's device timezone and is normalized to UTC. LUMA renders the scheduled dates in the program's IANA timezone; the UI explicitly explains the conversion to prevent false confidence.

## Security and reliability

- Claims: platform `superuser` is unrestricted; tenant admin requires `adminTenantIds` or matching `tenantIds/tenantId`. No scope in the request body grants privileges.
- Existing `FirestoreProgramDeliveryStore` persists the offering and session transactionally. No client Firestore writes; Firestore rules remain deny-all.
- Email, billing and live media provider secrets are not touched by this change.
- API `GET` and `POST` responses include no-store cache headers.
- Session changes should be followed by a UI refresh; signed LiveKit webhook evidence is kept in the existing room service.
- The UI intentionally does not offer arbitrary changes to past sessions or disabling admission of a running class. Only the established instructor completion flow can end ongoing LiveKit rooms.

## Engineering and acceptance gates

CI should validate TypeScript, lint, unit tests, Firestore emulator, Playwright and production Next.js build. Browser test denies unauthenticated program operations. Live course acceptance requires actual authorized admin identity, exact tenant separation, an active cohort with authorized coach, real LiveKit provider keys, and signed admission+attendance events. Configuring program records alone does **not** activate a paid LiveKit account.

Remaining enterprise gates: trustworthy course content RAG corpus, real merchant sandbox, live concurrency/load test, legal signing infrastructure and recoverability/retention/SLA drills.
