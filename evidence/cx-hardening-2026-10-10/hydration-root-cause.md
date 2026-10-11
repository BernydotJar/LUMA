# LUMA P0 — SSR hydration root-cause hardening

**Branch:** fix/cxh-dom-stability-touch-20261010, follow-up on draft PR #43. **Environment:** Next.js 16.3.8 production build + start, Playwright Chromium. **Release:** NO-GO until exact remote CI and downstream gates complete.

## Problem isolated

The learner route /learn is statically prerendered. LearnerGreeting formerly called new Date().getHours() during JSX rendering, embedding a build-time greeting in its static HTML. A client in a different time of day or timezone rendered different text and produced React hydration error #418 (server text differs from client text). This forces React to abandon or repair mismatched HTML; concurrent hydration can temporarily expose duplicated DOM. Prior independent QA observed two hero CTAs and two journey summaries at 30ms, stabilizing at 80ms. That observation is consistent with this hydration problem, but direct attribution of that one trace requires caution.

A second stable-layout defect existed: the prerendered/loading state returned a standalone paragraph, while the resolved guest state rendered a flex wrapper with the paragraph plus login link. Firebase Auth resolution changed block height, shifting the large headline and increasing CLS.

## Minimal fix

- Both server render and first client hydration use deterministic "Hola." instead of a build-time greeting. A client effect upgrades it to the local time-of-day greeting and refreshes on focus/visibility.
- Loading and resolved states keep the same guestGreeting wrapper, with min-height 44px and nowrap flex; the login link appears without increasing the greeting block height. Personalized greeting and auth remain unchanged in capability.
- Regression tests inspect raw static HTML, local greeting, React errors, CTA/journey uniqueness and reload. Timezones UTC, America/Guatemala and America/Los_Angeles; both browser projects.
- Standalone CommonJS QA evidence scripts have narrow file-local ESLint disable comments for no-require-imports; global product lint configuration, strict Playwright locators and failOnFlakyTests remain unchanged. This fixes GitHub Actions verify/lint failure on commit 4b68445.

## Before/after browser evidence

See hydration-before-after.json: unchanged baseline production build at localhost:3140 vs corrected build at localhost:3141, same Chromium worker.

| Browser timezone | Old prerender → browser | React #418 old | New prerender → browser | React #418 new |
| --- | --- | --- | --- | --- |
| UTC | Buenas noches → Buenos días | 1 | Hola → Buenos días | 0 |
| America/Guatemala | Buenas noches → Buenas tardes | 1 | Hola → Buenas tardes | 0 |
| America/Los_Angeles | Buenas noches → Buenas tardes | 1 | Hola → Buenas tardes | 0 |

Every corrected sampled page had one CTA, one journey summary and a 44px greeting wrapper. Targeted Playwright: 14 PASS, 8 skips for nonapplicable project/viewport cases. Finite sampling does not guarantee absence of all possible races.

## Paired Lighthouse 12.8.2 simulated mobile

See hydration-lighthouse-paired.json, based on three alternating runs per build with the same settings on the same worker.

| Metric (median) | Baseline | Corrected | Interpretation |
| --- | --- | --- | --- |
| CLS | 0.027018 | 0.000135 | Substantial layout stability improvement |
| LCP | 2676.3 ms | 2675.1 ms | Essentially unchanged: still misses <=2500ms goal |
| FCP | 1056.9 ms | 1056.4 ms | Essentially unchanged |

Lighthouse mobile throttling is simulated and localhost is not production CDN; these are not field p75 metrics. No raw reports containing public Firebase API configuration were added in this iteration.

## Gates

- [x] Build-time/client-local timezone mismatch reproduced and fixed
- [x] React hydration #418 reproduced before, absent in three sampled client timezones after
- [x] Guest greeting layout stability and CLS improvements measured
- [x] Targeted new timezone + mobile CTA tests PASS; original strict assertions remain
- [x] Full local CI-mode Playwright 131 PASS, 21 project skips, 0 failed/flaky, original CI strictness unchanged
- [ ] Exact new commit SHA GitHub Actions product/security/identity/Firestore/browser CI fully green
- [ ] Additional independent hydration stress on corrected build
- [ ] Mobile lab LCP <=2500ms, or product-approved exception grounded in field measurements
- [ ] Full signed-in browser QA with approved learner/coach staging identities, entitlement
- [ ] Manual WCAG 2.2 AA keyboard, 200% zoom, VoiceOver/TalkBack, safe-area review

**Release recommendation:** NO-GO. No merge or deployment. The prior emulator API integration gate (15/15) remains separate from browser acceptance.
