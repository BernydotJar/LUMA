# First-client academy intake security verification

Stacked branch `feat/first-client-institution-request-20261014` based on `fix/coach-program-rbac-20261014` at `6faf77d95e34c62514a640884587c14131f63ac2`. Local date: October 14 2026 Guatemala (October 15 UTC).

- Full suite **354 unit tests PASS / 81 configured SKIP**, ESLint PASS, TypeScript PASS, and Next.js webpack production build PASS. The intake slice adds 23 input/replay/feature-flag tests.
- 13/13 Next HTTP + Firebase Auth/Firestore Emulator scenarios PASS: guests 401, unverified identity 403, forged status/admin/tenant/email fields 400, invalid timezone 400, media/content size 415/413, server persistence, duplicate 200, conflicting repeat 409, cross-user isolation and forged uid GET ignored, recovery with fresh token and concurrent idempotency 201/200.
- Firestore has exactly two records in synthetic test, no tenant created and no Firebase admin custom claims issued. Synthetic Auth users deleted, emulator data discarded.
- An isolated Playwright Chromium synthetic-auth browser copy delivered **8/8 PASS**, 0 page JS errors, 390×844 mobile and 1440px desktop; verified application, receipt reload, another applicant's empty view, and open redirect denial all observed. Axe found six initial contrast failures; the form's semantic contrast tokens were corrected. Reruns: 0 automated WCAG 2 A/AA, 2.1 AA, 2.2 AA violations on Seres, Light and Dark modes. Six screenshots and complete ephemeral worktree instructions are in `browser/`. Real Google OAuth, manual screen-reader and customer browser QA remain separate signoffs.
- **NO-GO** for full institution onboarding: trusted human approval/invitation, real tenant draft activation, first course provisioning, privacy retention, abuse prevention and independent production-like QA are not covered by this slice.

- CI jobs `institution-intake` and `institution-browser` are attached to `deploy.needs`, with no manual or CI test bypass. CI must independently complete on exact pushed commit; passing local checks does not declare CI success.
