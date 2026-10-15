# Authenticated first-client Chromium QA evidence

**Source code revision tested:** 5332b8ed8b5c6bdee81f9c09ce83fde40cbe624c + two uncommitted PR-fixer UI-only files (hero before program picker, and picker anchor); those files are included in the follow-up PR commit. The TEMPORARY authentication overlay described below is **not** part of the product source or the fix branch.

**Scope:** Synthetic Firebase Auth and Firestore Emulators only, using local Next dev on `127.0.0.1:3191`. Isolated checkout name `/workspace/projects/LUMA-firstclient-browser-qa-20261014`; `demo-luma-firstclient-20261014` project. No customer data, production requests, Hotmart purchases, LiveKit sessions or production auth modifications.

## Test conditions

- Chromium Playwright headless. Learner phone-like browser context `390x844`, `isMobile=true`, `hasTouch=true`, deviceScaleFactor=1, reducedMotion enabled; coach desktop 1440x900.
- Login as four Firebase Auth emulator actors: owner, Mary-like coach, multi-enrolled learner, and unrelated tenant coach. All actors are temporary and deleted after test, with emulator data discarded.
- Create two Mary-style active offerings (premium live; evergreen asynchronous), one upcoming live session with no recording, grant both courses to the learner, write a real Firestore learning plan, then perform UI actions and inspect network request scoping.
- Responsive checks on `320x568`, `360x740`, `390x844`, `428x926`, `768x1024`. The 390x844 CTA first viewport was hit-tested separately in SE, Light and Dark; other sizes are scrolled into view and measured in Seres.

## Reproduction procedure (QA checkout only)

1. Clone the PR source into a disposable QA checkout named `LUMA-firstclient-browser-qa-20261014` outside a dirty repo. Run `npm ci` using an isolated cache. Never reuse a real Firebase key or real customer login.
2. Apply `qa-tools/temp-auth-shim.patch` to `src/lib/firebase-client.ts` only inside that disposable checkout. It gates use of Firebase Auth Emulator to `NODE_ENV=development` and `NEXT_PUBLIC_LUMA_QA_EMULATOR=true`, uses a **demo project** and calls `connectAuthEmulator` with `127.0.0.1:9099`. The product checkout must never contain this shim.
3. Copy the text from `qa-tools/temp-auth-login.tsx.txt` to disposable checkout `src/app/qa-emulator-login/page.tsx` (not committed). It implements email/password QA-only login against the demo emulator, with a hydration marker to prevent unhandled native form submits.
4. Copy `qa-tools/first-client-auth-browser.mjs` and `qa-tools/first-client-browser-gate.sh` to disposable checkout `scripts/qa/`, run `chmod +x scripts/qa/first-client-browser-gate.sh`.
5. Run (using JRE 21) `firebase emulators:exec --project demo-luma-firstclient-20261014 --only firestore,auth 'bash scripts/qa/first-client-browser-gate.sh'`. The gate guards `GCLOUD_PROJECT` prefix, 127.0.0.1 emulator hosts, exact disposable checkout basename, explicit temporary auth shim, and refuses an already-used QA port.
6. Inspect `evidence/first-client-browser-qa-2026-10-14/results.json` and screenshots in that disposable checkout. Compare with the attached `results.json` and `screenshots/`.

**Do NOT** add `qa-emulator-login` or test Firebase config to production or use this runner against a non-demo project. Keep this QA harness under evidence and do not wire it into production CI without a dedicated ephemeral environment.

## Result and visibility

Seven scripted scenarios PASS, none failed: two-course provisioning/entitlement; first learner login and explicit selection; mobile selected live class; three theme visible CTA hit testing; five responsive viewports with no horizontal overflow and reachable CTA after scrolling where necessary; evergreen change + reload session restore; coach scoped roster; foreign tenant coach denied. Browser page error tracker counted **three HTTP console resource errors**: 404 for uninitialized evergreen plan (expected no plan, not application crash) and 403 for unauthorized foreign coach; do not misclassify those as silent successful HTTP requests. Screenshots from a temporary auth overlay, not a deployed staging tenant.

The test result's viewport row metadata was normalized after execution to distinguish viewport `viewportHeight` from the actual measured `ctaHeight`, without changing observed CTA geometry, scroll position or clearance. The companion QA script now emits separate fields.

**Independent release verdict remains NO-GO** on tenant provisioning (#55), tenant-published curriculum (#57), same-tenant coach assignment semantics (#61), provider sandbox tests, manual WCAG 2.2 and production-like exact-SHA CI. Passing browser interactions proves only the bounded synthetic user story.
