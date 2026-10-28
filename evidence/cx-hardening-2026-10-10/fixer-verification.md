# LUMA CX hardening — fixer verification and release decision

**Date:** 2026-10-10. **Source under review:** BernydotJar/LUMA PR #39, feat/cx-hardening-20261010 at 7d1715c5171c464d6a4abd786f912418817fb397. **Fixer branch:** fix/cxh-dom-stability-touch-20261010 in isolated clean worktree /workspace/projects/LUMA-cxh-fixer-pr39-20261010. **Status:** code change candidate; does not update production. **Release decision: NO-GO until remote exact-SHA CI + manual and production-oriented gates close.**

## Purpose and scope

Continue from independent QA commit 6f8eb73, audit PR #39 without weakening strict assertions, repair 44px touch-target defects, remove unused LiveKit classroom CSS from the learner critical path, and add server-authenticated emulator assertions across role and tenant boundaries.

## Implemented changes

1. Learner journey summary and mobile practice CTA tests now assert **eventual uniqueness** with Playwright toHaveCount(1) before strict assertions and click. This rejects persistent duplicate DOM instead of picking the first element. CI failure originally arose when two DOM nodes matched; the transient duplicate's exact cause remains unconfirmed. This is a *test synchronization and observability correction*, not proof that a React hydration bug was fixed.
2. Learner goal link, practice explanation and next practice actions now have a minimum 44px hit target, preserving theme colors, copy and original page structure.
3. LiveKit component CSS moved from the application root layout into the classroom route layout; the learner route excludes classroom-only CSS, with Playwright regression verifying CSS is present inside a classroom. The change does not alter LiveKit access or video logic.
4. Synthetic emulator actor gate exercises entitled-mode access, on-server progression and coach/foreign-tenant negative authorization, including cleanup.

## Reproducible test results (fix branch local production build)

| Gate | Result | Evidence |
| --- | --- | --- |
| npm ci | PASS | npm install log |
| Next production build and TypeScript | PASS | /tmp/luma-cxh-fixer-build.log |
| ESLint | PASS | /tmp/luma-cxh-fixer-lint.log |
| Vitest unit tests | **291 passed, 52 skipped** | /tmp/luma-cxh-fixer-unit.log |
| Full Playwright with CI=true, 2 workers, original retries/failOnFlakyTests | **125 passed, 21 skipped, zero flaky/fails observed** | fixer-ci-local-summary.txt |
| Focused regression | 16 passed, 12 project skips | /tmp/luma-cxh-targeted-ci.log |
| Emulator authorized learner+coach API integration | **15/15 PASS** | entitled-emulator-actors.json |
| Original CI #38087249667 | **FAIL on 2 flaky at original SHA** | https://github.com/BernydotJar/LUMA/actions/runs/38087249667 |
| New remote GitHub CI | **PENDING after push** | Not to be claimed green before run finishes |

The emulator gate uses Firebase Auth + Firestore emulators only, project demo-luma-cxh-20261010; requires entitled-mode qa-tenant-a / qa-program-a, verified QA identities, guest 401, foreign-tenant learner 403, permitted learner onboarding 200, server rubric evidence version 2, independent fresh-token GET 200, program entitlement denial 403, scoped coach roster + event provenance 200, foreign coach 403, revoked access 403. Script uses disposable fake accounts and removes users, enrollment records and scoped learner records. It is **not** full interactive browser login with real QA tenant credentials.


## Independent follow-up verification and observed transient duplicate

- Independent fixed-build Playwright: **18/18 responsive geometry passes**; **18 axe route/theme scans, 0 violations**. Guest auth denials remain 401. Collected in fixer-geometry-axe-summary.json and independent-results.json.
- 390x844 SE first view clearance **124.23px**; 428x926 **211.83px**; compact 320x568 **242.08px** and 360x740 **328.02px** clearance after intentional scroll; all >8px. New spacing is slightly tighter than earlier PR patch because touch targets grew; geometry remains compliant.
- **P0 REPRODUCED:** one out of 15 independent load trials reported **two** hero CTA anchors and **two** journey summaries at t=30ms, returning to exactly one each at t=80ms. The synchronous selector wait toHaveCount(1) avoids CI flake without explaining the underlying transient duplicate. A separate 30-run DOM MutationObserver probe found zero duplicates, confirming intermittency (not disproving the one positive reproduction). Raw evidence: independent-results.json stress trial 1, dom-mount-probe.json.
- **Do not close underlying DOM duplication defect or declare CI root-cause fixed.** Further tracing should capture stack/mount/React hydration lifecycle at the exact positive snapshot. The release decision stays NO-GO.

## Geometry before/after and accessibility

Original deployed baseline (390x844 SE): primary CTA obstructed by bottom nav, clearance -34.38px. Prior exact PR #39 local audit: +129.73px on 390x844, +217.33px on 428x926; this patch slightly changes spacing to increase touch-target height. New independent geometry, axe and screenshots are collected into independent-results.json, screenshots/, with all cases re-evaluated on the fixed build; compact 320/360 cases require deliberate scrolling, not first-screen visibility.

Automated axe WCAG tags are a smoke test, **not** WCAG 2.2 AA certification. True 200% browser zoom, VoiceOver/TalkBack, real iOS/Android safe areas, keyboard interactions across all authenticated pages and manual contrast/feedback review remain outstanding. Original WCAG automated scans on PR #39 were 18/18 with zero violations.

## Performance: Lighthouse 12.8.2 locally

Simulated mobile Chrome 151: RTT 150ms, ~1638kbps throughput, 4x CPU slowdown, viewport 412x823. Three repeat runs LCP **2667.8, 2641.1, 2652.7 ms**, CLS ~0.027 and TBT 16.5-27.5ms. Three desktop LCP **856.7, 857.7, 863.1 ms**. Mobile still exceeds agreed <=2500ms lab target; desktop environment variance means do not interpret desktop difference as a speed regression without controlled replay. Raw reports and exact configs in fixer-lighthouse-summary.json and fixer-lighthouse-*-raw.json. Field INP and p75 LCP/CLS **not available**.

The stylesheet loading improvement did not independently bring mobile Lighthouse LCP under 2.5 seconds. More aggressive performance work must wait for bottleneck trace and separate independent regression; do not disable functionality for a lab score.

## Independent adversarial verification

Graph Harness command validated existing project event file (648 events, valid true) but does not self-certify code. IBM Granite 3.3:2b ran independently through local Ollama and completed successfully (response complete, stop, eval_count 410, UTC 2026-10-11 00:10). See granite-independent-critic.md for model, prompt SHA and verbatim output. The critic flagged residual transient duplicated DOM, global/style regression risk from route-scoped LiveKit stylesheet, emulator-vs-browser gaps, mobile LCP above target and manual WCAG/INP gaps; it did not certify release. The mitigation is real but the original root cause remains unresolved. The classroom stylesheet test passed both Playwright projects, and the complete guest UI/geometry/axe suite passed locally; neither substitutes signed-in device coverage. Producer is this fixer worktree. Independent Verifier is the separate geometry/axe/CI-mode/emulator protocol; no implementation-agent self-approval is accepted as release permission.

## Outstanding release blockers

- Fresh GitHub Actions fully green for the exact **pushed fixer commit**. CI skip counts are transparent; do not modify or disable failOnFlakyTests.
- A real approved staging/emulator browser learner + coach journey with scoped program enrollment, provider policy, re-authentication and evidence available across browser contexts; API-level emulator test alone does not prove full UX. No real customer accounts/data used here.
- Manual WCAG 2.2 AA, screen reader, true browser zoom/large type, cross-device safe-area and error/recovery flows.
- Mobile LCP <=2.5s under reproducible laboratory conditions, actual field p75/INP only when RUM is available.
- Explicit independent reviewer, documented product owner release decision, protected PR acceptance, rollback readiness. **No merge / deploy until approval.**

**Recommendation:** preserve separate fixer PR as draft, attach sanitized artifacts, request independent release verification; do not promote to main or production while outstanding gates remain.
