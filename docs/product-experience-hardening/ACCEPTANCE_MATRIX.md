# LUMA CX Hardening — Acceptance Matrix

**Status:** OPEN. Blank checks mean not yet verified; no automatic “pass” inferred from existing code or unrelated CI.

## 1. Responsive, navigation and visual system

| Test | Guest | Learner | Coach | Theme | Device | Acceptance | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| First action within usable viewport | ✓ | ✓ | n/a | se/light/dark | 390×844, 428×926 | CTA full rectangle above fixed nav by ≥8px on first view, button h≥44px | OPEN |
| Small display reachability | ✓ | ✓ | n/a | se/light/dark | 320×568, 360×740 | Scroll CTA fully into view; no overlap on activation | OPEN |
| Sidebar/header semantics | ✓ | ✓ | ✓ | se/light/dark | 768/1024/1440 | No horizontal overflow, appropriate role controls and visible focus | OPEN |
| Mobile bottom tabbar | ✓ | ✓ | ✓ | se/light/dark | portrait and landscape | Safe-area/bottom positions, keyboard focus, complete nav links, no inert badges | OPEN |
| Program/module navigation | ✓ | ✓ | ✓ | se/light/dark | mobile/desktop | All authorized modules selectable, empty/locked states honest | OPEN |
| Theme persistence | ✓ | ✓ | ✓ | se/light/dark | mobile/desktop | Theme survives reload and does not flash wrong palette | OPEN |

## 2. Learner → coach E2E evidence chain (dedicated test tenant)

| Step | Route / data boundary | Expected behavior | Evidence | Status |
| --- | --- | --- | --- | --- |
| Guest entry | `/learn`, `/login` | Login status clear; no fabricated personal achievement | screenshot/DOM | OPEN |
| Learner login | Firebase Auth (emulator or staging) | Valid QA learner, session created, role scoped | redacted token-claim verification | BLOCKED until QA identity/tenant validated |
| Enrollment | Entitlement ledger / test offering | Valid test-tenant enrollment; denied otherwise | Firestore write/read assertions | OPEN |
| Onboarding | `/onboarding` | Goal/time selection stored under authorized learner | secure state assertion | OPEN |
| Practice | `/learn/session/pas` | Finish activity with rubric feedback, honest outcome | `SIMULATION_COMPLETED` receipt with provenance | OPEN |
| Session restore | `/learn` in new browser context | Same authorized learner, evidence restored from server, not cross-user localStorage | independent browser trace | OPEN |
| Coach insight | `/studio` → learner detail | Coach sees authorized learner evidence and uncertainty | role/tenant assertions | OPEN |
| Negative access | coach/other tenant, guest | Cross-tenant API/data reads are denied even if URL guessed | API + Firestore denied request | OPEN |
| Revoke & clean | Auth and Firestore emulator | Test claims revoked; test fixtures cleaned; audit remains appropriate | teardown log | OPEN |

## 3. Accessibility audit

For each core route and theme (se/light/dark), record automated **axe WCAG 2 A/AA + 2.1 + 2.2 tags where supported**, keyboard-only navigation, focus order/visibility, 200% text/zoom, reduced motion, screen-reader announcements, accessible names, modal/popover return focus, and contrast.

- **Routes:** `/learn`, `/onboarding`, `/learn/experiences`, `/learn/session/pas`, `/studio`, tutor/chat, certificates and classrooms where authorized fixtures exist.
- **Automated acceptance:** 0 critical/serious violations, with any other violations triaged and evidenced; automated scan != complete WCAG conformance.
- **Manual acceptance:** one keyboard-only and one VoiceOver/TalkBack walkthrough recorded with device/tool/version and findings.
- **Release blocker:** inaccessible primary CTA, form, results, or role-sensitive control.

## 4. Performance and stability

| Measurement | Goal | Collection context | Status |
| --- | --- | --- | --- |
| LCP | p75 ≤2.5s | authenticated + guest, representative RUM with sample size | Not measured |
| INP | p75 ≤200ms | real user interaction data if available | Not measured |
| CLS | p75 ≤0.1 | field data where available | Not measured |
| Lab LCP/CLS | baseline vs after, no regression | Lighthouse/Chrome trace, throttling declared, 3 repeats | Not measured |
| Long tasks | no new blocking on practice start | browser performance trace | Not measured |
| Error/retry | reasonable recovery, no dead-end | simulated offline, API failure, expired identity | Not verified |

**Important:** Lab results and user-field results must never share an unlabeled column; report p75 only if real RUM exists.

## 5. Release and audit

- [ ] Fresh clean worktree + exact base SHA recorded
- [ ] Pre-change mobile geometry reproduced as failing test
- [ ] Mobile fix passes viewport / theme matrix
- [ ] QA actor journey complete (or real-identity part explicitly BLOCKED)
- [ ] Automated a11y + manual follow-up completed
- [ ] Performance baseline and after evidence recorded
- [ ] Independent UX + security Critic responds to Producer change
- [ ] Fixer resolves blocking issues
- [ ] Independent Verifier confirms release gate
- [ ] Unit tests, typecheck, lint, build and Playwright for exact commit are green
- [ ] Protected PR reviewed and merge approved explicitly
- [ ] Deployment/rollout source provenance, smoke, rollback validation recorded

## Baseline URLs

- Production: https://luma.lch-app.cloud/learn
- Last observed green main CI: https://github.com/BernydotJar/LUMA/actions/runs/38031714611
- Graph Project: `graph-harness.project.json`

Recorded baselines and raw evidence belong in `evidence/cx-hardening-2026-10-10/` with timestamps, source revision, viewport, UA and theme. Use `PASS`, `FAIL`, `BLOCKED` per test; never silently assume `PASS`.
