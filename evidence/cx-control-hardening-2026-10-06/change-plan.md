# LUMA CX Control Plane Hardening — Change Plan

Date: 2026-10-06
Branch: feature/luma-cx-control-hardening
Graph node: LUMA-003-twin-tutor

## Files to modify
- src/app/api/tutor/route.ts — insert deterministic CX control before RAG / existing tutor flow; remove unsafe default fallback; tighten grounding.
- src/app/api/tutor/cx-control.ts — bounded recent-turn normalization, deterministic intent/risk routing, policy boundaries, ambiguity and frustration recovery, RAG relevance gate.
- src/app/api/tutor/cx-control.test.ts — focused deterministic regression tests.
- src/app/api/tutor/route.test.ts — route-level regressions for Granite findings and happy path.
- src/components/tutor-panel.tsx — send an optional bounded recent-turn payload while preserving the existing message contract; understand new trust states.
- evidence/cx-control-hardening-2026-10-06/** — baseline, tests, Granite transcripts/verdicts, verifier and release decision.

## Files explicitly not to modify
- src/lib/pnl-rag.ts and src/lib/pnl-rag.test.ts
- Persistent Learning Twin / Firestore implementation
- SE Voice implementation
- apphosting.yaml / Firebase deployment configuration
- curriculum/module content
- coach/learner authorization implementation outside the tutor
- unrelated UI/theme files

## API contract impact
Existing request `{ message: string }` remains valid.
Optional additive field: `messages: Array<{ role: "learner" | "tutor"; content: string }>`; server bounds and normalizes it.
Responses gain additive observability fields such as `intent` / `outcome`; existing `answer`, `evidence`, `reflection`, `learningMove`, and `trust` remain.

## Risk / blast radius
Low-to-moderate and localized to `/api/tutor` plus its client payload. Main risk is over-classification causing legitimate learning requests to clarify instead of answering. Fail-closed behavior is intentional for privacy/access, ambiguity, unsupported intents, and weak grounding.

## Backward compatibility
- No database-backed conversation state.
- No route rename.
- Existing static learning responses remain.
- Existing high-stakes medical boundary remains.
- Existing PNL RAG adapter remains the retrieval implementation.
- Clients that send only `message` continue to work.

## Required tests
- 4-turn frustrated learner: no verbatim loop, strategy changes.
- Unauthorized Twin access: policy blocked, no curricular fallback, no grounded claim.
- Ambiguous missing context: needs clarification, no fabricated memory.
- Contradictory exact-answer instruction: safest clarification.
- Existing P.A.S./belief/emotion happy path still grounded.
- Out-of-scope input cannot fall through to P.A.S.
- RAG evidence cannot be `GROUNDED` unless relevant to the current query.
