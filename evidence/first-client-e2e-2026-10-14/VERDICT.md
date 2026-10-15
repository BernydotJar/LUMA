# LUMA — Independent first-client E2E quality verdict

**Date:** 2026-10-14 (Guatemala) / test closed 2026-10-15 UTC
**Repository/base SHA:** `BernydotJar/LUMA`, `7ef32ba9ff3c56896da536a86ca14286b99ddfb3`
**Branch:** `audit/first-client-luma-20261014`
**Environment:** Cloud Sandbox isolated Next.js 16.3.8 production build on 127.0.0.1:3184 (guest browser), 127.0.0.1:3185 (entitled server) and ephemeral Firebase Auth/Firestore Emulators under `demo-luma-firstclient-20261014`. **Never production learners.**

## Executive verdict: NO-GO for autonomous first academic customer

LUMA can render a learner home, guide practice, capture a local guest receipt and support server-persisted enrollment/evidence for authenticated learners via the API. However a first academy owner has **no self-service institutional registration**, learner catalog is static rather than enrollment-aware, and entitled learner/coach APIs require a selected program that the first-client UI does not supply. Customer ticketing and configurable outbound follow-ups are not present in the tested routes.

## Independent browser guest evidence (13/13 checks technically PASS)

`first-client-guest-results.json`, plus 12 1440/390px screenshots under `screenshots/`. 13 scripted behaviors completed as written; this is **not** 13 customer-business capabilities accepted.

- Landing `/` redirects to `/learn`; visible first practice CTA.
- Google sign-in screen has no academy registration action (0).
- Four-step learner onboarding stores `luma-onboarding` locally; guest UI reloads from browser storage.
- Seven hard-coded learner experiences in `/learn/experiences`.
- PAS practice emits client receipt `SIMULATION_COMPLETED`; anonymous learning-plan API returns 401. Guest localStorage is **not** server persistence.
- Tutor replies to P.A.S. question with curriculum reference, but this does not prove a tenant-specific corpus.
- Studio programs, enrollments and coach screens show appropriate anonymous gates.
- No support-ticket affordance and tested `/support/tickets` / `/tickets` both 404.
- `/studio/automation` and `/api/automation` both 404; no client-schedulable follow-ups.
- Institutional draft GET returned 503 `feature_unavailable` with default flag disabled.
- Mobile at 390×844: practice CTA 49 px tall, 64.25 px away from fixed nav; overflow 0.
- No page errors observed in the 13 scripted checks.

## Authenticated end-to-end with Firebase Emulators

`first-client-emulator-results.json`, test implementation `scripts/qa/first-client-emulator-journey.mjs`, guarded runner `scripts/qa/first-client-emulator-gate.sh`.

First run **8 PASS / 1 FAIL**: coach roster query in entitled mode returned `409 program_selection_required` because no `x-luma-program-id` was supplied. Failure was not suppressed; read `src/lib/coach-scoped-learning.ts` and `src/lib/coach-api-client.ts`. Added an explicit selected-program header to the **test only**, documented the missing-header 409 as the expected negative case and reran. Second run **11 PASS, 0 FAIL**:

1. Guest 401, wrong-tenant admin 403, ordinary learner 403 for academic management.
2. Tenant-scoped administrator created active Mary-style premium/live and evergreen/asynchronous offerings.
3. Premium class scheduled with no recording; asynchronous course refused live session; wrong tenant 403.
4. Institutional bulk: 2 grants, 1 duplicate, 1 invalid; retry granted 0 additional.
5. Evergreen grants issued, including a user enrolled in both programs; tenant list has four enrolments.
6. Email identity claims: one live, one evergreen, one both; corresponding schedules 1/0/1.
7. Two-course learner returned **409 program_selection_required** without explicit course and 404 missing plan (rather than false access) with explicit program header.
8. Premium learner wrote onboarding and one event to Firestore; new Firebase ID token recovered state/version 2 and last event ID.
9. Coach without course header also returned **409**; with explicit program header saw scoped roster and evidence; cross-tenant coach 403, guest 401.
10. Scoped coach intervention GET works; POST outbound follow-up returns **405 Method Not Allowed**.
11. Revoking premium learner's institutional grant causes subsequent learning-plan request to return 403, while separate student's multi-program enrollment remains intact.

The script deletes emulator Auth actors and `firebase emulators:exec` tears down temporary databases. No production tenant, identities, Hotmart transaction or LiveKit traffic.

## Root cause and release priorities

| Severity | ID | User story | Evidence | Gate |
|---|---|---|---|---|
| P0 | FC-01 | Brand-new owner creates their organization without external admin | /login Google only; institutional draft 503 | BLOCKED — implement governed onboarding, provisioning and audit |
| P0 | FC-02 | Multi-enrolled learner selects actual course | public catalog static, scoped API 409 without header | FAIL product experience; API contract passes with header |
| P0 | FC-03 | Mary selects coaching program and views learners/evidence | `fetchCoachLearners()` and `fetchCoachInterventions()` do not send required program header | FAIL product experience; API contract passes with header |
| P1 | FC-04 | Owner authors lessons, question bank and rubric | /studio/programs administers offerings/sessions, not curricular editor | NOT VERIFIED / product design gap |
| P1 | FC-05 | Learner opens and follows support ticket | 404 tested, no affordance | NOT IMPLEMENTED in tested surface |
| P1 | FC-06 | Owner schedules follow-up and sees delivery receipts | outbound POST 405, UI 404 | NOT IMPLEMENTED in tested surface |
| P1 | FC-07 | Real merchant payment, actual LiveKit audio/video, actual Mary tenant | only synthetic emulator and demo catalog covered | BLOCKED on approved provider sandbox and identities |

## Graph Harness SDLC and verification limitations

**Producer:** review the exact-main source, execute guest browser + server emulator operations.
**Critic:** this independent QA report classifies valid backend operations separately from product experience; IBM Granite not invoked this run.
**Fixer:** bounded follow-up on FC-02/03 and governed organizational onboarding; do not weaken authorization.
**Independent verifier:** this isolated audit branch verifies API, Firestore and UI only in the listed environments.
**Release gate:** NO-GO until the P0 experience and authenticated browser flows are demonstrated, manual a11y and exact-SHA CI are reviewed.
**Evidence:** companion JSON results, 12 screenshots and script. The pass count describes test assertions, not feature completeness.

**Not covered:** signed-in browser login to app (Firebase client is bound to non-emulated project in base), end-to-end real merchant fulfillment, real video, tenant curriculum uploads, 50-course paging stress, support and automations after implementation, manual WCAG, Core Web Vitals field p75. They remain explicitly BLOCKED/NOT IMPLEMENTED, never PASS.

Tracking: [First-client epic #54](https://github.com/BernydotJar/LUMA/issues/54), [organization #55](https://github.com/BernydotJar/LUMA/issues/55), [multi-course #56](https://github.com/BernydotJar/LUMA/issues/56), [authoring #57](https://github.com/BernydotJar/LUMA/issues/57), [support #58](https://github.com/BernydotJar/LUMA/issues/58), [automations #59](https://github.com/BernydotJar/LUMA/issues/59).

**No merge/deployment, no new permissions or production data.**
