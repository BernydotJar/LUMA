# Security findings — source-level authorization regression

## QA-SEC-001 — Instructor expulsion can inherit stale commercial ban reason

**Severity:** P0 for authorization integrity; **status:** corrected in source, deployment unverified.

**Precondition:** a learner roster document already has a commercial `banReason=enrollment_revoked`, then an authorized instructor removes that identity using the `/moderate` API, and later a paid enrollment becomes active.

**Before fix:** the moderation route's Firestore merge supplied only `bannedAt` and `bannedBy`. The old `banReason` remained `enrollment_revoked`. `mayRestoreRevokedLearnerAccess` permits lifting that reason after a newer valid enrollment, so an instructor removal could be overridden by a payment. The test designed to demand sticky moderation failed twice on the original implementation.

**After fix:** the route writes an explicit `instructor_removed` ban reason and clears the stale revocation job marker. A later commercial grant cannot satisfy the reinstatement predicate. The guard remains in the backend and is independent of visible UI state.

**Reproduction:** `npm run test:run -- 'src/app/api/live/classrooms/[offeringId]/[sessionId]/moderate/route.test.ts'` on the pre-fix parent SHA `7effcd08e7df429e6f219d0df40e3d3ce8b0cd23` after adding the regression test failed 2/3; on `3fe24da039ec379967ab8ddd338dbaedf5ad0e38` passes 3/3.

**Provider-failure assertion:** if LiveKit removal fails, the request returns HTTP 503 while the moderation ban remains persisted. It must not return a successful removal acknowledgement.

**Limitations:** this is a deterministic unit reproduction with provider/Firestore writes mocked. Production exploitability and staging remediation are not attested. The next independent UAT must exercise Firestore persistence and the actual Cloud expulsion/rejoining behavior.

## Untested critical threat boundaries

Cross-tenant/cohort access, Cloud-only token revocation including refreshed JWTs, signed webhook replay/out-of-order delivery, concurrent refund/token mint, and ten/fifty user load remain blocked or untested in this run. They are not marked PASS.
