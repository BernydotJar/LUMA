# LUMA — Graph Harness product hardening verification

**Date:** 2026-10-13. **Branch:** `feat/learner-lifecycle-p0-20261013`. **Baseline:** main `7ef32ba9`.

## Roles and scope

Producer: feature branch. Critic: adversarial review of client storage, entitlements, and source provenance. Fixer: implement secure identity-scoped state and UX recovery. Independent executable verifier: **separate Playwright + Firebase Auth/Firestore Emulator worktree**, distinct runtime and clean QA actors. This is a deterministic second execution orchestrated by the same agent, not a second independent human auditor. Human release authority retained.

## Quality gates demonstrated

| Gate | Result | Evidence |
| --- | --- | --- |
| Jeremy → Abigail: no cross-account local goal/graded receipt | PASS | browser-e2e.json |
| Jeremy: PAS 3/3 persists after new reflections and fresh browser | PASS | browser-e2e.json + Firestore |
| Adán: self-report restored without changing graded mastery | PASS | browser-e2e.json + firestore-emulator-qa.json |
| Claimed buyer & explicit public sample; nonbuyer API 403 | PASS | browser-e2e.json |
| Tutor: no fake sources, actionable retry and published session link | PASS | browser-e2e.json |
| Full Vitest suite | 317 pass, 82 skipped, 0 fail | validation-summary.json |
| Firestore Emulator dedicated store suite | 5 pass | firestore-emulator-qa.json |
| Existing Chromium desktop | 26 pass, 1 skipped | legacy-chromium-regression.json |
| Existing Chromium mobile | 26 pass, 1 skipped | legacy-chromium-mobile.json |
| ESLint and TypeScript | PASS | validation-summary.json |
| Optimized Next.js webpack build | PASS | validation-summary.json |
| All seven modules with authorized playable lessons and resume | BLOCKED | LESSON_PUBLICATION_GATE.md |
| Real Hotmart staging, Google OAuth, LiveKit A/V, WCAG manual, field CWV, signed certificate | BLOCKED | LESSON_PUBLICATION_GATE.md |

## Critic findings requiring next sprint

- The offline retry key is now UID + server-confirmed tenant/program scoped and safe against replay into another purchased course. Full multi-program UI selection is still not implemented; an ambiguous enrollment must fail closed, not default to an arbitrary purchase.
- Unscoped historical browser data is deleted on authentication changes. This is a deliberate privacy-first migration, but previously unsynced anonymous records cannot be reconstructed.
- Public practice previews contain educational source summaries. Institutional rights and the exclusive lesson-asset security perimeter must be reviewed before uploading private premium content.
- A tutor recovery link to a scheduled session is not a direct instructor messaging service; owner must publish an authorized human-help route.
- A 3/3 PAS after hints is not independent mastery. The rubric now preserves attempts but program certification requires instructor-approved policy.
- QA is synthetic: no real OAuth provider, commerce sandbox callback, classroom AV session, manually exercised assistive technologies, field performance distribution or independent customer signoff.

## Release outcome

**Enterprise complete-course release remains NO-GO**. Core P0 fixes passed local verifier; external quality/learning content gates are still blocked. Do not auto-merge or deploy. See `graph-harness.learner-lifecycle.project.json` and the append-only Graph Harness event chain.

## 2026-10-13 — Subsequent adversarial CI repair

First PR #51 workflow **Product quality** (run `38460562978`) found **2 Firestore failures** due to a previously unexercised ledger input: writing an optional `lastScoredEvidence: undefined` to a Firestore document. This disproved the original claim that all stateful Firestore gates were closed. The feature code was repaired to omit optional fields instead of serializing `undefined`, and new regression assertions exercise ungraded and verified scores. Replaying the exact six Firestore suites against a fresh emulator yields **51 passed, 0 failed**. The new synthetic browser run covers **17 passed, 0 failed**, including replay ownership isolation by UID/tenant/program, tutor state reset on account switching and access denials.

Recorded artifacts: `evidence/learner-lifecycle-20261013/firestore-full-postfix.json` and `browser-e2e-postfix.json`. A local PASS does not substitute for the next actual GitHub CI result; the gate must be verified on the new PR SHA. The corresponding failure/repair transition is preserved in the Graph Harness event chain.

## Guest-access selector defect found in complete GitHub browser suite

Full GitHub Actions browser job on SHA `558b35a6f9969763c5a1ed9ea4541731acd47696` (run `38462477308`) reported **123 passed, 7 skipped, 2 failed**. Both failures were the same accessible-name collision, on Chromium and mobile: `getByRole("link", { name: "Acceder", exact: true })` matched both the account-menu link and the public-practice enrollment notice. The UI now preserves the conventional account-menu label and calls the second, more specific guest action **"Iniciar sesión"**, with a regression assertion for exactly one of each. Targeted desktop/mobile rerun: **5 passed, 1 skipped, 0 failed**. Full GitHub browser suite must run again on the correction before the guest-access graph node is closed.
