# Adversarial critic and independent verifier — LUMA-072

**Reviewer methods:** Code-path security review performed separately from the implementation, local IBM Granite 3.3 2B attempted as a second, distinct model, and replay through actual Next.js HTTP handlers with disposable Firebase Auth/Firestore Emulators.

**Granite tool status:** `ollama run ibm/granite3.3:2b` exceeded the 120-second local deadline (exit 124). Its response was incomplete; **it is not an independent PASS certification**. The partial output raised broad themes: role verification, active vs historical cohorts, >100-offering capacity, and negative access tests. The specific security conclusions below derive from source review and executable tests, not from claiming Granite finished.

| Critic concern | Source-level finding | Reproducible verification | Result |
|---|---|---|---|
| Coach membership mistaken for read authorization | Original `coachCanReadEnrollment` accepted `coachTenantIds` for program-wide evidence without offering assignment | Base issue #61: unassigned same-tenant coach got HTTP 200 for learner detail; now all 3 coach surfaces HTTP 403 | MITIGATED in isolated fix |
| Different active or archived cohorts share a program-wide Twin | Learning store keys by tenant/program/UID; `offeringId` not part of evidence key | Synthetic second cohort with a distinct teacher blocks partial teachers. Archiving does **not** restore; explicit historical-cohort assignment required | FAIL-CLOSED; final isolation OPEN #63 |
| Coach role or course changed mid-session | Long-lived ID token holds tenant membership, not offering grants | Admin reassigns course; old coach 403, new coach 200 and then 403 after revocation **without token refresh** | PASS |
| Excessive tenant course count | Firestore tenant query has `.limit(101)`; denies at 101 instead of truncating silently | Create 100 offerings => catalog works; 101 => `409` on discovery AND learner evidence | SAFE DENIAL; scale OPEN #64 |
| Cross-tenant read or revoked learner | Server tenant is configured and active commerce enrollment verified | Foreign coach HTTP 403, learner revoke denies, admin restricted to own `adminTenantIds` | PASS in emulator |

**Independent verification limitations:** this is emulator-backed application HTTP, not licensed customer staging, manual WCAG, field-performance or actual third-party payment/live-class testing. Built-in unit tests may validate implementation assumptions and are not independent proof by themselves. Browser screenshots collected by PR #62 predate this RBAC patch; they are not claimed as new browser test results for this branch. GitHub CI remains a separate exact-commit gate.

**Release decision:** The bounded P0 issue #61 behavior is corrected in source pending CI and independent review. The wider LUMA product remains NO-GO for enterprise pilot until remaining gates #55, #57, #63, #64 and provider/UX acceptance close. No merge or deployment.
