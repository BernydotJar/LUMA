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

- Current offline event queue partitions by Firebase UID, but program switching needs an explicit UID+tenant+program binding before LUMA supports multiple paid courses simultaneously. Do not replay unknown-origin offline events across programs.
- Unscoped historical browser data is deleted on authentication changes. This is a deliberate privacy-first migration, but previously unsynced anonymous records cannot be reconstructed.
- Public practice previews contain educational source summaries. Institutional rights and the exclusive lesson-asset security perimeter must be reviewed before uploading private premium content.
- A tutor recovery link to a scheduled session is not a direct instructor messaging service; owner must publish an authorized human-help route.
- A 3/3 PAS after hints is not independent mastery. The rubric now preserves attempts but program certification requires instructor-approved policy.
- QA is synthetic: no real OAuth provider, commerce sandbox callback, classroom AV session, manually exercised assistive technologies, field performance distribution or independent customer signoff.

## Release outcome

**Enterprise complete-course release remains NO-GO**. Core P0 fixes passed local verifier; external quality/learning content gates are still blocked. Do not auto-merge or deploy. See `graph-harness.learner-lifecycle.project.json` and the append-only Graph Harness event chain.
