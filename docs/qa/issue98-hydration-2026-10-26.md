# LUMA #98 — SSR hydration mismatch on learner home

**Date:** 2026-10-26  
**Candidate base SHA:** `fbaa553c55695fe6b114dcff2117d82694920efb`  
**Issue:** https://github.com/BernydotJar/LUMA/issues/98  
**Scope:** standalone learner-home fix, no change to PR #71, CI security gate, or production.

## Reproduction and causal evidence

The production `/learn` HTML included a greeting of `Buenos días` while the browser in `America/Guatemala` and other local zones computed a different greeting during hydration. The pre-fix `LearnerGreeting` rendered `new Date().getHours()` directly inside a client component that Next.js prerenders to HTML. When the build-time/server clock and the user's clock differ, the client hydration text disagrees and React can report minified error `#418`. This is a genuine server/client nondeterminism; it is not a broken API or a caching problem. The report in issue #98 documents desktop and mobile reproduction.

An earlier isolated local branch `qa/student-journey-e2e-20261021` included a candidate resolution (commit `19bf522`) that was not in protected `main`. The present PR transplants only the relevant greeting component, supporting CSS and hydration regression test onto the current protected hotfix base, independently verifying them with the current dependency tree (Next.js `16.4.2`).

## Implementation

- First server render and the initial client render use deterministic `Hola`, so hydration text matches.
- After React mounts, an effect computes `Buenos días`, `Buenas tardes` or `Buenas noches` from the actual user's local clock, retaining the personalized display name.
- Browser focus and document visibility changes refresh the greeting; event listeners are cleaned up.
- A consistent greeting wrapper avoids transient structural changes while authentication finishes.
- CSS prevents long display names from overflowing the learner home and maintains accessible link hit targets.

## Acceptance tests

All commands ran in an isolated Sandbox V3 checkout based on the protected hotfix SHA, without changing `main` or production.

| Control | Result |
|---|---|
| `npm ci` | PASS; Next.js `16.4.2` |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test:run` | 331 PASS, 81 SKIP |
| `npm run build` | PASS; production output, `/learn` statically prerendered |
| `CI=1 PLAYWRIGHT_PORT=3101 npx playwright test e2e/learner-hydration-stability.spec.ts --workers=2` | 6 PASS / 0 FAIL |
| `CI=1 PLAYWRIGHT_PORT=3101 npx playwright test --workers=2` | 131 PASS, 7 SKIP, 0 FAIL, 0 flaky |

The targeted tests exercise desktop Chromium and emulated mobile Chromium across `UTC`, `America/Guatemala` and `America/Los_Angeles`. They require stable SSR markup, exactly one visible greeting, no duplicate practice buttons or journey controls, no client page errors, and no errors after reload. Full suite covers existing public/role boundaries and UI routes. The seven skipped scenarios remain excluded by the current test inventory; they are **not** counted as approved.

## Release decision and next steps

**Technical candidate:** eligible for GitHub CI and independent review as a **separate PR against `main`**. The local test run is not a substitute for an exact-commit GitHub Actions run. Do not merge to protected `main` or deploy until normal release requirements are satisfied; the prior owner-authorized emergency exception applied only to security PR #96 and does not transfer to issue #98.

**Product acceptance:** NO-GO until the separate Graph Harness enterprise acceptance and independent source-signing requirements are complete. The health/SHA monitoring automation is independent of this PR.

