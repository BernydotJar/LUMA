# LUMA — Live Classroom enterprise QA / moderation regression

**Decision: NO-GO for a customer-facing Zoom replacement.**

**Tested implementation SHA:** `3fe24da039ec379967ab8ddd338dbaedf5ad0e38` (stacked LUMA PR #77 on #73).
**Acceptance engine:** Graph Harness PR #5, SHA `b3e991eaff98822defdd20287fa110586953abde`.
**Runtime:** isolated Cloud Sandbox and local Firestore Emulator. No staging LiveKit Cloud or Firebase-authenticated customer class was exercised in this increment.

## Executed and reproducible results

| Control | Observed | Boundaries |
|---|---|---|
| Moderator ban regression (red before fix) | 2 of 3 tests failed | The route persisted no explicit ban reason |
| Moderator ban regression (after fix) | 3/3 passed | Mocked instructor route and provider; verifies persistent write contract |
| Full Vitest suite | 353 PASS, 98 SKIPPED | Emulator-only tests omitted from this particular suite |
| Stateful Firestore Emulator revocation | 10/10 passed | Firebase Emulator with mocked LiveKit; synthetic data only |
| Playwright classroom guest denial | 4/4 passed | Desktop/mobile Chromium with locally served Next.js; unauthenticated access only |
| ESLint + TypeScript | PASS | Local source-level validation |
| Graph Harness validate | PASS | Source graph/event shape valid, not a release decision |
| Graph Harness product acceptance | NO_GO, 20 actions, 82 blockers | No trusted production SHA, no independent breadth review, missing four-axis proofs |

## Confirmed source defect

`src/app/api/live/classrooms/[offeringId]/[sessionId]/moderate/route.ts` persisted `bannedAt` and `bannedBy` but not `banReason`. With Firestore merge semantics, an existing `enrollment_revoked` reason could survive an instructor expulsion, allowing later commercial reactivation to clear a moderator decision. Fix persists `banReason=instructor_removed` and deletes stale `revocationJobId`. Reproduction and post-fix assertions are in the adjacent route test.

## Non-negotiable P0 blockers

1. LiveKit Cloud QA project credentials and explicitly protected, isolated GitHub environment are absent from this sandbox; provider Cloud old/refreshed JWT replay was **NOT_TESTED**.
2. A separately deployed Firebase staging project, synthetic institution users and attested deployment SHA are not available. The connected Firebase CLI exposes only an existing LUMA project; no assumption of staging or production permission is made.
3. Authenticated instructor + two learners, refund webhook, provider removal, reconnect and actual branded controls lack full runtime evidence.
4. No independent reviewer decision for the exact final PR SHA. PR #71 integration/release gate still requires independent revalidation.

**Safety:** no production write, environment flag flip, Cloud provisioning, secret disclosure, protection bypass, signed approval or artificial acceptance.
