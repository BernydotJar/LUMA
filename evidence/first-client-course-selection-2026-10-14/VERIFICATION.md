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

1. **Local authenticated browser QA PASSED** for the scoped multicourse story (7 scenarios, 0 failures) using disposable Firebase Auth and Firestore emulators and a QA-only development auth shim in a separate checkout. **Approved staging browser and client-owned curriculum provenance remain BLOCKED**; static component tests and local emulator testing do not establish production identity/provider readiness. See `browser/README.md` and `browser/results.json`.
2. Real tenant academic publishing and enrollment-aware content catalog. Existing lessons/exercises remain showcase data.
3. Governance for tenant provisioning and coach per-program assignment vs tenant-wide coaching roles.
4. Real Hotmart entitlement/webhook/refund, live classroom participation and notification delivery, plus WCAG 2.2 AA and field performance acceptance.
5. Confirmed P0 semantics mismatch: coachTenantIds grants tenant-wide evidence access despite zero matching assigned-offering choices. Reproduced in Auth/Firestore Emulator, GitHub #61. Define and independently test intended role matrix before release.

Release recommendation: NO-GO; prepare a draft implementation PR for independent QA, not merge or deploy.

## Browser journey and responsive geometry (isolated emulator)

The first authenticated Chromium run found a mobile hierarchy regression: the course picker was placed before the hero and pushed the primary practice CTA beneath the fixed bottom navigation at 390×844. Before-fix evidence exists in the QA run screenshots; **a numeric before-fix clearance was not recorded**. The implementation moved the course picker after the practice hero for a learner who has selected a course. For an unselected multi-enrolled learner the picker remains the sole initial step, intentionally requiring a course choice.

The independent second run used temporary, development-only demo Firebase client setup; no auth bypass or emulator-login route is committed to product source. After-fix measured `getBoundingClientRect` and hit-testing:

| Viewport | CTA height | Visible bottom-nav clearance after allowed scrolling | Scroll Y | Horizontal overflow | Result |
|---|---:|---:|---:|---:|---|
| 320×568 | 49px | 229.08px | 541px | 0px | PASS |
| 360×740 | 49px | 22.28px | 26px | 0px | PASS |
| 390×844 | 49px | 90.75px | 0px | 0px | PASS |
| 428×926 | 49px | 177.34px | 0px | 0px | PASS |
| 768×1024 | 50px | 286.55px | 0px | 0px | PASS |

At 768×1024 the mobile bottom navigation is hidden; clearance is measured to the viewport bottom. At 320×568 the CTA requires scrolling to a usable position. No horizontal overflow and interactive hit testing passed for each size.

For **390×844 at the first screen without scrolling**, all three themes (`se`, `light`, `dark`) measured: **49px CTA height, 90.75px clearance above fixed navigation, 0px horizontal overflow, successful hit test, scrollY=0**.

The learner selected Mary premium, saw the relevant live session and verified the scoped learning-plan header; switched to evergreen, confirmed that the unrelated live session disappeared; refreshed and recovered the program. The authorized Mary-like coach selected premium and loaded the scoped roster. A foreign-tenant coach was denied and saw no select. Browser console recorded 2 expected 404s for uninitialized plan and one expected 403 for foreign-tenant access; these statuses are disclosed, not treated as silent success.

**Caveat:** test validates a local Chromium emulator journey and geometry, not manual screen-reader proficiency, field Core Web Vitals, real Google OAuth or multi-tenant production configuration. Release remains NO-GO for issues #55, #57, #61 and independent staging/provider readiness.
