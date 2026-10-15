# Isolated authenticated intake browser verification

**Boundaries:** Chromium Playwright, disposable Firebase Auth + Firestore Emulators on `demo-luma-firstclient-intake-20261014`, local Next dev `127.0.0.1:3194`. This is NOT production or real Google OAuth. The QA client Auth SDK config and temporary emulator login page were applied ONLY in the disposable worktree `LUMA-firstclient-intake-uiqa-20261014` and MUST NOT be committed as application routes or deployed.

**Results:** 8/8 PASS, zero runtime JavaScript errors. Guest sees verification CTA, verified applicant opens form and submits through real Next.js API to Firestore, server receipt persists after reload, an independent user cannot see it, and untrusted redirect `?next=https://example.net/evil` stays in LUMA. At 390×844 the form has 50px field height, 51px primary button height and 0px horizontal page overflow. Axe-core evaluated WCAG 2 A/AA plus 2.1 AA and 2.2 AA on the Seres/Light/Dark themes, 0 automatic violations in all three. This is **not** manual screen-reader/accessibility certification.

**Important discovered defect:** first axe pass failed serious contrast on six UI nodes including eyebrow, muted labels and button. Implementation changed ONLY local request-page theme semantic tokens for readable contrast, preserving institutional accents; the second browser run verified zero violations.

## Reproduce without production authentication

1. Create a **separate** disposable checkout from the PR source, install dependencies, copy `qa-tools/emulator-auth-overlay.patch` to `src/lib/firebase-client.ts` using `git apply --unidiff-zero` inside this disposable checkout only (zero-context overlay is pinned to the exact QA source). Copy `qa-tools/emulator-login.tsx.txt` to `src/app/qa-emulator-login/page.tsx` inside disposable checkout only.
2. Copy QA runner files to `scripts/qa/first-client-institution-browser.mjs` and `scripts/qa/first-client-institution-browser-gate.sh`, mark the latter executable.
3. Use a demo-only Firebase Auth+Firestore Emulator project and Java 21: `firebase emulators:exec --project demo-luma-firstclient-intake-20261014 --only auth,firestore 'bash scripts/qa/first-client-institution-browser-gate.sh'`. The gate refuses non-demo project, non-local emulators, non-QA checkout and an unpatched Auth Emulator SDK.
4. Review resulting `evidence/first-client-institution-browser-2026-10-14/results.json` and mobile/desktop screenshots.

Exact client auth overlay, test-specific password identities and synthetic Firestore records are never shipped. Production enrollment/tenant creation remains disabled/unsupported in this step. Human approval, abuse protection, retention/deletion, publication and manual accessibility remain NO-GO.
