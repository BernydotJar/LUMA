# Independent first-client multi-course fix: QA evidence

Date: 2026-10-14 Guatemala, execution on 2026-10-15 UTC.
Base SHA: 7ef32ba9ff3c56896da536a86ca14286b99ddfb3.
Fix branch: fix/first-client-multi-course-selection-20261014.
Scope: Synthetic Firebase Auth/Firestore emulator + local Next.js build, never production users or payment records.

## Verified

- ESLint and TypeScript run cleanly in controlled, sequential commands.
- Vitest final run: 324 PASS / 81 SKIP / 0 FAIL; ESLint PASS; TypeScript PASS.
- Next.js 16.3.8 webpack production build completed PASS with one page worker following all application source edits (CIRCLE_NODE_TOTAL=2).
- Explicit program selection fixes 409 for authorized learner and coach API calls, without weakening 401/403 denial checks.
- New GET /api/programs/my-courses returns counts 1, 1, 2 and 0 for four synthetic learner identities; GET /api/coach/programs lists the coach's two assigned offerings.
- No extra institutional grant is created by idempotent bulk import retry; server plan/evidence is restored with fresh Firebase ID token; revocation returns 403 and removes the revoked course from the selector.
- ProgramPicker has accessible label/control and visible recovery/refresh actions. Schedule filter intentionally excludes another course's sessions from active course UI.

## Independent adversarial critic

IBM Granite 3.3 2B is available locally. A sanitized recommendation summary is in granite-suggestions.txt. Claims about a hypothetical vulnerability are suggestions, not observed defects. QA separately reviews entitlement and coach scope contracts. The additional same-tenant role-policy probe returned HTTP 200 evidence for an unassigned coach with tenant-wide access while the assigned-program selector returned zero options. This is a confirmed RBAC policy/UI mismatch (#61), not a cross-tenant bypass.

## Remaining release blockers

1. Staging browser session using approved synthetic learner and coach identities to verify first login, picker, keyboard/mobile UI, program change, session restore and content provenance. Static component HTML tests are NOT authenticated browser E2E.
2. Real tenant academic publishing and enrollment-aware content catalog. Existing lessons/exercises remain showcase data.
3. Governance for tenant provisioning and coach per-program assignment vs tenant-wide coaching roles.
4. Real Hotmart entitlement/webhook/refund, live classroom participation and notification delivery, plus WCAG 2.2 AA and field performance acceptance.
5. Confirmed P0 semantics mismatch: coachTenantIds grants tenant-wide evidence access despite zero matching assigned-offering choices. Reproduced in Auth/Firestore Emulator, GitHub #61. Define and independently test intended role matrix before release.

Release recommendation: NO-GO; prepare a draft implementation PR for independent QA, not merge or deploy.
