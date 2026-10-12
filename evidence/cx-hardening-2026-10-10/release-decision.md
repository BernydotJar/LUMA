# LUMA — Independent QA & Product Experience Verification

**Decision: FAIL / NO-GO for release. Learner-to-coach end-to-end gate: BLOCKED.**

**Audit date:** October 10, 2026. **Repo:** BernydotJar/LUMA. **PR:** https://github.com/BernydotJar/LUMA/pull/39. **Tested branch:** feat/cx-hardening-20261010. **Exact SHA:** 7d1715c5171c464d6a4abd786f912418817fb397. **QA branch:** audit/independent-qa-pr39-20261010; separate clean worktree /workspace/projects/LUMA-qa-pr39-20261010. **Environment:** Next.js 16.3.8 production build served at http://127.0.0.1:3124, Linux headless Chromium, Playwright, no production accounts. Production https://luma.lch-app.cloud was a reference only.

**Sources:** CI https://github.com/BernydotJar/LUMA/actions/runs/38087249667; browser job https://github.com/BernydotJar/LUMA/actions/runs/38087249667/job/114316691551; original failure screenshots/trace https://github.com/BernydotJar/LUMA/actions/runs/38087249667/artifacts/11682779282. Source documents PRIORITIES.md, AGENT_EXECUTION.md, ACCEPTANCE_MATRIX.md, 040-product-experience-hardening.json, product-completion-gate.md all read before execution.

## 1. Executive quality verdict

The exact PR SHA compiles, responsive guest geometry passes 18/18, axe returns zero violations on 18 route/theme scans, and the dedicated Firestore/auth emulator passed 26 focal tests. Four anonymous API requests correctly returned 401. Graph Harness events validate. The original two CI flakies did **not** recur in 15 instrumented load trials or targeted non-retry Playwright repeats.

**However, CI browser at the exact SHA is FAILED; no trusted real-identity learner→coach complete journey, field p75, manual screen-reader review or valid production rollout receipt exists. Mobile throttled LCP is above its 2.5-second objective. No merge/deploy approval.**

## 2. Findings with reproduction, priority and action

| ID | Priority | Observation | Reproduction and required action |
| --- | --- | --- | --- |
| QA-001 | P0 release gate | GitHub browser job FAILED: two tests failed then passed on retry because Playwright strict locators resolved to **two elements**, not because text was missing or CTA invisible. Reason for transient duplicated DOM **unproven**. | Inspect CI browser job / artifact; rerun production build with CI=true npm run test:e2e under concurrent workers. Instrument DOM uniqueness and hydration/mount lifecycle. Preserve strict assertions and failOnFlakyTests; **do not** use .first() or arbitrary retries to mask this. |
| QA-002 | P0 BLOCKED | No approved learner/coach/foreign-tenant QA identities and staging tenant for full browser/API/Firestore proof. LocalStorage-based demo is not server persistence. | Provision disposable entitled identities; run guest→auth→enrollment→onboarding→practice→server receipt→new browser session→authorized coach→cross-tenant denial→revocation and cleanup. |
| QA-003 | P1 | Lighthouse simulated mobile LCP **2.644, 2.690, 2.678 s**, all above 2.5s target. | Lighthouse 12.8.2 /learn simulated mobile; target render-blocking (~342ms suggested) and unused JS (~85,676 bytes suggested); capture three new runs. |
| QA-004 | P1 CX | Three mobile guest learner touch targets under comfortable 44px height: goal link 38px; practice explanation 40px; secondary start action 40px. | At 390x844, inspect getBoundingClientRect() in independent-results.json. Increase touch hit areas to at least 44px. Not automatically a WCAG 2.2 AA failure. |
| QA-005 | P1 verification gap | Manual VoiceOver/TalkBack, actual browser 200% zoom, entitled role accessibility, RUM LCP/CLS p75 and INP remain unverified. | Execute genuine manual/device checks. A CSS-only 200% zoom simulation showed horizontal overflow, but is **not proof** of a browser-zoom WCAG violation. |
| QA-006 | P2 | Showcase E2E seeds SIMULATION_COMPLETED in localStorage and verifies display, not Firestore. The UI correctly labels it “Práctica registrada en este dispositivo.” | Separate local demo from a dedicated server-receipt/new-session authenticated regression; avoid mislabeling local storage as durable remote evidence. |

### CI incident details

CI run 38087249667, browser job 114316691551: 115 passed / 15 skipped / **2 flaky** → browser FAILURE → deploy skipped. Security, identity-roles, Firestore and verify jobs all succeeded. Initial failure A e2e/showcase.spec.ts:165 on '#journey summary' was **strict mode: two summaries**. Failure B e2e/mobile-cta-occlusion.spec.ts:48 at 390x844/dark on 'section[data-variant="hero"] a.button-primary' was **strict mode: two CTA anchors**. Do not infer a loading-state or theme defect without matching evidence.

## 3. Mobile geometry: baseline vs exact PR SHA

Baseline came from the prior deployed guest version; after is a **separate local build of the audited PR SHA**, not a production deployment.

| Viewport | Prior baseline SE | Exact PR SHA independent | Result |
| --- | --- | --- | --- |
| 320x568 | CTA below first viewport | **+242.58px clearance after deliberate scroll** | PASS scroll |
| 360x740 | CTA below first viewport | **+328.52px clearance after deliberate scroll** | PASS scroll |
| 390x844 | **−34.38px** CTA/nav overlap | **+129.73px** CTA/nav clearance on initial view | PASS first screen |
| 428x926 | +82.25px clearance | **+217.33px** clearance on initial view | PASS first screen |
| 768x1024 | Not measured | Mobile nav absent, no horizontal overflow | PASS geometry |
| 1440x900 | Not measured | Mobile nav absent, no horizontal overflow | PASS geometry |

Across SE, Light and Dark, all **18 geometry** cases: exactly one CTA and journey summary at stable sampling, zero horizontal overflow, CTA height ≥44px, unobstructed center hit test, retained theme after reload. The 320/360 result is NOT first-viewport visibility. Raw data after.json and independent-results.json; three guest screenshots in screenshots/ and existing pre-change baseline.json.

## 4. E2E summary

| Environment | Pass | Skip | Flaky | Verdict |
| --- | ---: | ---: | ---: | --- |
| Exact SHA CI browser | 115 | 15 | 2 | FAIL release |
| Local repeat of two original test selectors: 10 repeats × Chromium+mobile | 30 | 10 | 0 observed | PASS locally, 0 retries |
| Independent stress reload/DOM count: 15 separate contexts and five post-load samples each | 15 contexts | 0 | 0 observed | 1 CTA and 1 journey summary at every sample |
| Full local E2E (132 collected), no retries | **117** | **15** | **0 observed** | PASS locally, CI remains red |

A passing local rerun does not repair previously failing exact-SHA GitHub CI. Do not disable failOnFlakyTests.

## 5. Learner and coach end-to-end acceptance

| Journey segment | Independent evidence | Status |
| --- | --- | --- |
| Guest/access/navigation | Public guest UI / Playwright | Partial PASS |
| Learner login and entitlement | Auth entry point, isolated entitlement tests | Authenticated browser BLOCKED |
| Goal/onboarding/practice feedback | Existing demo E2E; local event fixture | Local-only PASS, server chain BLOCKED |
| Firestore persistence and idempotency | 26/26 emulator tests across four suites; server-side receipt readback | PASS in isolated emulator |
| Independent session restore | No approved signed-in identity to reopen in a new browser | BLOCKED |
| Coach evidence and intervention | Scoped coach tests; guest API 401 | Integrated coach role BLOCKED |
| Tenant isolation / revocation | Same UID under tenant/program combinations isolated; revoked active-entitlement replay denied in emulator | PASS isolated unit/emulator; actor API BLOCKED |
| Cleanup | Disposable emulator state destroyed; no real records created | PASS local |

The emulator ran under Java 21 on test ports 8091/9101 with demo-luma-qa39. Guest GET/PUT /api/learning/plan, POST /api/learning/events and GET /api/coach/learners each returned HTTP 401. **No real learner or customer data was accessed.**

## 6. Accessibility and CX

18/18 independent axe scans, across /learn, /login, /onboarding, /learn/experiences, /learn/session/pas and /studio, all three themes, returned **zero violations** tagged WCAG 2 A/AA, 2.1 A/AA and 2.2 AA. They test guest UI only, not full WCAG conformance. Keyboard Tab smoke at 390px confirmed visible focus; three elements reported at bottom-nav height were **members of that bottom navigation**, NOT controls obscured behind it. Enter successfully opened the recommendation explanation in all three themes. Reduced-motion preference was emulated. 44px UX target remains open.

The product has a clear primary action and progressive disclosure, consistent with Fitts, Hick, proximity and cognitive-load heuristics. Aesthetic quality and interaction semantics require representative manual coach/learner and device review; no redesign is recommended without measured evidence. Screen reader, native device safe areas and true zoom remain BLOCKED.

## 7. Performance

Lighthouse v12.8.2, Chrome 151, exact SHA local build, 3 simulated throttling runs per device.

| Run | Mobile LCP | Mobile CLS | Mobile TBT | Desktop LCP |
| --- | ---: | ---: | ---: | ---: |
| 1 | 2644ms | 0.027 | 18.5ms | 591ms |
| 2 | 2690ms | 0.027 | 40.5ms | 593ms |
| 3 | 2678ms | 0.027 | 34.0ms | 609ms |

Mobile performance score 96–97/100; desktop score 100/100. LCP element is #learner-home-title. Network simulation: 150ms RTT, 1638.4kbps throughput, 4× CPU slowdown, mobile 412x823 (DPR 1.75). No real user p75, actual production-device performance or INP evidence. Unthrottled local PerformanceObserver values must NOT be confused with these lab results. No before/after optimization is claimed (QA changes only). See lighthouse-summary.json, lighthouse-mobile-raw.json, lighthouse-desktop-raw.json.

## 8. Adversarial review and release controls

Producer: the implementation PR #39. Independent critic/verifier: this separate read-only QA execution from exact SHA, source inspection, browser test instruments, CI log analysis and emulator. **IBM Granite was not available/configured; no Granite review is claimed.** Graph Harness validation of existing events returned valid=true, 648 events; this does **not** certify release.

The required exact-SHA quality gate is RED, two P0 acceptance controls remain unfulfilled, and human production decision is absent. No PR merge, no Firebase deploy, no permission change, no real data access and no customer-facing side effects occurred.

## 9. Regression requirements and explicit outstanding gates

1. Resolve or reproduce transient duplicate DOM at both strict locators on CI; ensure original assertions pass with failOnFlakyTests and no retry dependence.
2. Re-run all 18 geometry cases and touch hit-target matrix on the new SHA; native safe-area/zoom and keyboard focus.
3. Approved test tenant with entitled QA learner/coach/foreign tenant; verify real API/Firestore receipt and fresh browser restore plus scoped coach and denials, then cleanup.
4. Manual screen-reader and genuine zoom session; WCAG 2.2 AA conclusions scoped honestly.
5. Improve mobile Lighthouse simulated LCP ≤2.5s across repeated tests without appearance or access regressions; instrument production RUM p75 and INP before asserting those SLOs.
6. All CI jobs passing on exact release SHA, independent critic/verifier receipts, deployment provenance/rollback validation and explicit human approval.

**Final recommendation: NO-GO.** Public guest/mobile geometry is substantially improved and independently demonstrated. LUMA's full secure and reliable learner/coach journey is **not yet independently approved**.

## 10. Evidence index

- before: baseline.json (prior deployed baseline)
- after: after.json and independent-results.json (PR build)
- repeatability: Playwright original GitHub artifact and local repeat logs
- a11y: independent-results.json, keyboard-results.json, zoom-sim-results.json
- perf: lighthouse-summary.json and two raw Lighthouse reports
- Graph: graph-validation.json
- guest screenshots: screenshots/
- critique: critic.md; actor/gap: actors.md; separate detail: a11y.md and performance.md

No secrets or real learner response records are retained in this artifact set.
