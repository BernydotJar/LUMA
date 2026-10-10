# LUMA — Product Experience Hardening
**Version:** 1.0 · **Baseline:** `main` at `7daba30` (2026-10-10) · **Owners:** Product / Frontend / QA / Security / Release
**Status:** Planned workstream; individual tasks move to verified only with evidence.
**User journeys:** participant (learner), entrenador (coach), tenant administrator where relevant.
**Product principle:** Premium is clarity, trust and fluidity — not decorative AI claims, unnecessary glass or extra screens.

## GitHub execution queue

- [Epic / release gate #38](https://github.com/BernydotJar/LUMA/issues/38)
- [P0 Mobile CTA #34](https://github.com/BernydotJar/LUMA/issues/34)
- [P0 Learner → coach journey #35](https://github.com/BernydotJar/LUMA/issues/35)
- [P1 Accessibility #36](https://github.com/BernydotJar/LUMA/issues/36)
- [P1 Performance #37](https://github.com/BernydotJar/LUMA/issues/37)

## Objective

Take LUMA's existing editorial learner experience from “implemented and deployed” to **validated, reliable, accessible and demonstrably useful**, without changing its product positioning or remaking the UI.

Work in this order:

```text
P0 Mobile first action / safe-area
         |
         v
P0 Learner + coach end-to-end journey / access + evidence
         |
         v
P1 WCAG 2.2 AA / keyboard + screen-reader / 3 themes
         |
         v
P1 Real user performance and stability / Web Vitals
         |
         v
P2 Interaction polish / product release review
```

### Verified starting point (not an acceptance result for this workstream)

- `https://luma.lch-app.cloud/learn` responds HTTP 200 and serves the new editorial hero and one practice action.
- `main` Product quality run **38031714611** completed green (109 E2E passing, 7 skipped; browser/security/Firestore/identity-roles/deploy jobs success).
- Original learner page was ~4,920 px on desktop and ~7,271 px on mobile; editorial version was ~2,759 px and ~3,787 px, respectively. These are measured snapshots, not performance budgets.
- **Open defect (P0):** at `390 × 844` CSS px, initial mobile CTA box approximately **top 747 / bottom 796** intersects the sticky mobile nav at **top 762 / bottom 834** (34 px overlap). Visual review across devices is still required. The existing E2E checks `actionBottom < 980`, which fails to detect this occlusion.
- Headline/brand direction is approved; avoid visual redesign unless it resolves a measured CX pain point.

## Prioritized execution backlog

| ID | Priority | Work item | Exit/acceptance | Evidence |
| --- | --- | --- | --- | --- |
| **CXH-001** | **P0** | Mobile action visibility, sticky nav, safe-area, responsive viewport | At 390×844 and 428×926 on initial entry, the entire primary CTA is above the fixed nav with ≥8 CSS px separation; at smaller 320×568 / 360×740 it is fully reachable by scrolling without occlusion. Width overflow=0. Target ≥44×44 CSS px; keyboard focused element is not hidden. Three themes pass. | Geometry-based Playwright test + mobile screenshots (no screenshot-only assertion). |
| **CXH-002** | **P0** | Authenticated participant → practice → evidence → coach journey | In a **dedicated emulator/staging tenant**, create/reuse approved QA learner and coach identities, assign only required entitlements, complete practice, verify server-persisted receipt, new-session retrieval, learner next-step view, coach permitted observation, and explicit access denial across tenants. No synthetic learner achievement displayed as verified without receipt. | Playwright/Firestore emulator traces, redacted receipt assertions, access-control matrix, verified cleanup and failure diagnostics. |
| **CXH-003** | **P1** | WCAG 2.2 AA and inclusive interactions | Automated axe has **0 critical/serious violations** on core learner/coach routes for each of three themes; keyboard navigation, visible focus, skip/landmark semantics, 200% zoom/text, reduced motion, correct labels, readable contrast, and at least one manual VoiceOver/TalkBack walkthrough are recorded. Full WCAG conformance cannot be claimed from axe alone. | Axe JSON + route/role/theme matrix, screenshot review, manual screen-reader checklist and remaining exceptions. |
| **CXH-004** | **P1** | Core Web Vitals, production-like stability | Record reproducible mobile/desktop baselines, then target p75 **LCP ≤2.5 s**, **INP ≤200 ms**, **CLS ≤0.1** if representative RUM is available; otherwise report Lighthouse + browser trace as *lab values*, not field metrics. No visible hydration errors; async states/route transitions remain responsive. | Versioned performance trace, config/device/network, source commit and before/after report. |
| **CXH-005** | **P2** | Small interaction polish / learner comprehension | Meaningful empty, loading, failure and recovery states; one primary action per view; no disabled-looking inert buttons; copy avoids fake claims; polished tap feedback without motion overload; coach and learner language consistent. | Before/after annotated screenshots, task-completion walkthrough, critic findings closed. |
| **CXH-006** | **Release gate** | Graph Engineering adversarial review and guarded deployment | Producer → Critic → Fixer → independent Verifier → Release Gate → Evidence. No merge/deploy on red gate. CI build/security/Firestore/role and browser jobs pass for exact SHA; production smoke proves correct revision, routes and rollback readiness. | PR, CI links, immutable receipt/report and approval record. |

## Actor journey — CXH-002 mandatory assertions

1. **Guest:** sees no personal achievements or coach-only access; knows whether sign-in/enrollment is required.
2. **Learner:** signs in as **QA identity**, selects program/goal, and has a valid membership/entitlement for the **test tenant**; cannot open other tenants.
3. **Practice:** starts/resumes the same meaningful action, completes a rubric-backed activity and sees specific feedback, rubric provenance, and next recommended step. No made-up mastery score.
4. **Persistence:** reloading, signing back in, and a distinct browser context preserve **authorized** progress; unauthenticated/foreign tenant cannot read it. Where local-only mode is used, label that limitation explicitly.
5. **Coach:** signs in separately with correct tenant/coach claims, sees only the learner evidence permitted by role, distinguishes observed evidence from inference, and can identify the next human intervention.
6. **Failure:** expired entitlement/token, empty learner dataset, pending content, network error, disabled classroom and missing permissions produce clear non-leaky recovery paths.
7. **Lifecycle:** use disposable QA accounts or approved existing test identities, revoke access, delete QA fixtures and provide cleanup receipt without exposing real learner PII.

### Non-negotiable scope constraints

- Protect existing `main`, Firebase App Hosting runtime, Cloudflare routing, three themes, LiveKit, certificate and commerce capabilities.
- No new hosting provider, no new container, no database restructuring, no extra app framework, no major dependency replacement for UX cosmetics.
- Do not assume developer/admin links imply authorization. Server verifies tenant, user and entitlement **per request**.
- No production purchase, enrollment, email, account creation, permission change or external video/meeting action without explicit authorization and appropriately provisioned QA environment.
- Do not log secrets, email addresses, tokens, learner responses or sensitive pedagogical content in CI artifacts; redact screenshots with real account identifiers.
- Real people doing UAT require informed approval and privacy safeguards; emulator-only testing must be labeled emulator evidence.
- Preserve accessible interaction with Liquid Glass transparency/motion disabled.
- Human approval required for irreversible external effects, production deployment and customer-facing copy changes that make business claims.

## Execution order and stop conditions

**Gate A — baseline:** fresh branch from current remote `main`, capture current SHA, app smoke, CI status and repro geometry. No changes to dirty worktrees.

**Gate B — CXH-001:** reproduce failing mobile nav overlap with geometry assertion; implement the smallest well-justified fix; pass viewport/theme matrix, no regression on desktop; save screenshots.

**Gate C — CXH-002:** run authorized QA actor end-to-end, validate scoped persistent evidence and negative authorization; if no approved test identities/tenant exist, stop at emulator coverage and mark real-actor acceptance `BLOCKED`, not `PASS`.

**Gate D — CXH-003/004:** measured accessibility and performance; capture raw evidence and assumptions; repair only documented findings.

**Gate E — CXH-005/006:** independent Granite critic if actually available, independent verifier and release pipeline; do not merge/redesign/deploy on unverifiable or failed controls. Return a concise summary of completed gates, open defects, PR and release IDs.

## Definition of Done

`DONE` means all P0 items validated; P1 automated checks green and manual review exceptions transparently tracked; no critical security/accessibility issues; Graph and CI gates green; release provenance/rollback evidence exists; product owner has reviewed representative three-theme desktop/mobile screenshots. P2 polish may remain a separate documented backlog but must not hide a P0 defect.

## Source locations

- `src/components/adaptive-learning-home.tsx`, `next-action-card.tsx`, `app-shell.tsx`
- `src/app/learn/learn.module.css`, `src/components/learner-components.module.css`, `app-shell.module.css`
- `src/lib/learning-api-client.ts`, `src/lib/learning-entitlement.ts`, `src/lib/learning-server.ts`
- `e2e/learner-home-editorial.spec.ts`, `e2e/responsive-mobile.spec.ts`, `e2e/auth.spec.ts`, `e2e/adaptive-loop.spec.ts`
- `.github/workflows/quality.yml`, `scripts/release/*`, `graph-harness.project.json`
- `docs/enterprise/product-completion-gate.md`, `docs/enterprise/tenant-isolation-contract.md`

**Quality baseline:** [GitHub run #38031714611](https://github.com/BernydotJar/LUMA/actions/runs/38031714611).
**Production baseline:** https://luma.lch-app.cloud/learn
**Autonomous execution brief:** [AGENT_EXECUTION.md](AGENT_EXECUTION.md).
