# LUMA — PR #78 secure learning assessment reconciliation

**Date:** 2026-10-20. **Baseline:** LUMA #71 `f082289eaae1b1fc978a722ca65494adac0e674c`; **original learning feature SHA:** `d975eaeed2d694f2827e3352fd02169f43a411b1`. This integration is staging only; no merge to protected main, no production deployment.

## Conflict resolution and protected functionality

The original PR #78 came from an older learner product branch and had conflicting identity, storage, UI, tutor and Graph Harness history. It was **not** merged by replacing these files blindly. Its feature hunks were applied to the PR #71 source, with manual reconciliation in `adaptive-learning-home.tsx`, `tutor-panel.tsx`, `persistent-learning.ts`, `learner-components.module.css` and the learner assessment client.

- Preserve #71 per-UID/per-program entitlement selection, server projections, latest assessed evidence, mobile CTA safe areas, protected retrieval and fail-closed client state.
- `ProgramEntryAssessment` is keyed by UID and selected program, sends `x-luma-program-id` and validated JWT via shared scope guard, rejects asynchronous account/program drift and never treats assessment as certified mastery.
- The contextual tutor accepts class/step hints only. Its server rebuilds source context under authenticated learner entitlement; the UI reuses scoped auth headers and checks again after API responses.
- The program assessment Firestore store checks tenant/program cohort scope, at-most-once events, plus transactional concurrent submission restrictions. Existing #71 scored-evidence snapshot remains separate from the observed-only diagnostic.
- The guest primary course CTA and Liquid Glass layout remain operational. The #78 WCAG contrast fix on its source SHA was included: fixed dark blue action background instead of the too-bright theme accent.

## Verified exact local source

- ESLint and TypeScript: PASS.
- Vitest full suite: **435 PASS / 87 SKIP** (emulator-dependent skipped).
- Next.js production build: PASS.
- Full Playwright Chromium desktop+mobile: **162 PASS / 22 SKIP**, 0 failures (includes new assessment and class tutor tests).
- Real Firestore Emulator (existing Firebase CLI v15.32.1, JRE21): **2 PASS**, verifying tenant/program isolation, idempotency and simultaneous submission serialization.
- Original Graph Harness ledger: **712 valid events**; not rewritten or spliced with branch-specific learning graph records.

## Graph Harness evidence integrity

The original learning branch had **different** `graph-harness.events.jsonl`, `graph-harness.project.json` and `evidence/graph-harness-status.json`. These are **independent fork evidence**, not append-safe records for PR #71. Preserve these under the namespaced `evidence/learning-ui/pr78-original/` paths in the final merge tree. A later authorized GraphRuntime acceptance must validate and record new events on the actual integrated SHA and explicitly adjudicate LUMA-070/071 rather than creating a synthetic event chain.

## Remaining release gates

No independent reviewer signed the final candidate, protected Ed25519 key is not provisioned, and the trusted workflow still needs separate bootstrap on protected main. Authenticated classroom LiveKit provider UAT and enterprise customer action coverage remain NO-GO. Technical test PASS does not authorize publishing or certificate issuance.
