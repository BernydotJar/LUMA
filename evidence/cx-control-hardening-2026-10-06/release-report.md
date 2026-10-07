# LUMA CX Control Plane Hardening — Release Report

Date: 2026-10-06
Branch: `feature/luma-cx-control-hardening`
Graph scope: `LUMA-003-twin-tutor`
Decision: **PASS — bounded CX hardening is ready for review on this feature branch. Do not merge directly to main.**

## WHAT CHANGED

LUMA keeps the existing tutor, RAG, Twin, learning model, Firebase deployment model and learner flows. A thin deterministic CX control layer now runs before retrieval / curricular routing.

Implemented:
- bounded recent-turn context (maximum 8 messages, bounded message size),
- deterministic intent/risk routing,
- privacy / unauthorized-access fail-closed behavior,
- frustration recovery with materially different strategies across repeated turns,
- ambiguity handling that either resolves from available recent context or asks for the minimum clarification,
- contradictory-instruction handling without fabricating an exact answer,
- preservation of the existing high-stakes medical guardrail,
- removal of the unsafe `responses.find(...) ?? responses[0]` semantic fallthrough,
- explicit `INSUFFICIENT_CONTEXT`, `INSUFFICIENT_EVIDENCE`, `POLICY_BLOCKED`, and `RETRIEVAL_UNAVAILABLE` trust states,
- RAG relevance verification before a response can be classified `GROUNDED`,
- additive optional `messages` API payload while preserving `{ message }` compatibility,
- learner UI sends bounded recent context and can render policy-blocked trust state.

## WHAT DID NOT CHANGE

Not changed by this hardening:
- `src/lib/pnl-rag.ts` and its retrieval implementation,
- Persistent Learning Twin / Firestore,
- SE Voice,
- Firebase / App Hosting configuration,
- curriculum/module content,
- coach/learner source-of-truth authorization outside the tutor,
- route names,
- unrelated visual system / themes.

`apphosting.yaml` baseline SHA-256 and final SHA-256 are identical:
`b5de20ba3a98ba91732cfb984daa4be6b239592ddcb08d4159da61fd4352f1cc`.

## ARCHITECTURAL DECISIONS

1. **Extend before replacing.** The new layer controls routing/safety and delegates legitimate learning requests to the existing tutor / RAG implementation.
2. **No new persistent conversation store.** Recent context is supplied by the existing client in a bounded optional payload.
3. **Deterministic first.** Intent/policy classification uses deterministic rules; no LLM classifier was introduced.
4. **Fail closed for privacy/access.** Claimed director/executive authority is never treated as verified authorization.
5. **Grounding is intent-relative.** A RAG hit is not enough by itself; evidence must pass a minimum relevance check for the current query.
6. **No semantic default fallback.** Unsupported/unmatched input asks for clarification instead of returning the first P.A.S. response.
7. **Protected concurrent work remains protected.** The task started with uncommitted PNL RAG changes already present in `route.ts` and `tutor-panel.tsx`. Those were captured as baseline evidence and were not reset/stashed/deleted.

## FILES MODIFIED / ADDED

Product:
- `src/app/api/tutor/route.ts`
- `src/app/api/tutor/cx-control.ts`
- `src/components/tutor-panel.tsx`

Tests:
- `src/app/api/tutor/cx-control.test.ts`
- `src/app/api/tutor/route.test.ts`

Evidence:
- `evidence/cx-control-hardening-2026-10-06/**`

Safe handoff patch:
- `evidence/cx-control-hardening-2026-10-06/hardening-only.patch`
- SHA-256: `f462410e7c68fb6694a40b3aa4f21beda042cef92a8715719c8472d4dcd246d1`
- This patch is relative to the protected PNL working tree that existed at task start.

## GRAPH ENGINEERING EXECUTION

### Inspect
- Captured initial branch, dirty working tree, hashes and pre-existing route/panel diff.
- Verified `LUMA-003-twin-tutor` permits the tutor API and tutor panel paths.
- Confirmed Granite models and prior PO/CX evidence were available.

### Producer
- Added bounded deterministic CX control.
- Integrated it ahead of RAG / static curricular routing.
- Added focused regression tests and optional recent-turn API contract.

### Critic
Critic testing exposed:
- Vitest alias/mock harness failures — preserved as failed evidence and repaired only in tests.
- A real happy-path regression: `P.A.S.` punctuation did not normalize to `pas`.
- Fix was applied in normalization; no default fallback was reintroduced.

### Fixer
- Corrected acronym normalization.
- Hardened repeated policy/ambiguity/frustration behavior so multiple adversarial rounds do not collapse into verbatim loops.
- Preserved fail-closed policy and trust semantics.

### Independent Verifier
- Deterministic verifier evaluated all 12 adversarial rounds.
- IBM Granite 3.3 was then invoked independently, with no implementation role and no code access, to challenge the gate.
- Independent verdict: **PASS / 3 of 3 STRICT_PASS**.

A Granite 4 verification attempt failed because the local llama-server process was killed by the runtime. That failed artifact is preserved and was **not** rewritten as PASS. A separate isolated Granite 3.3 verifier was used instead.

### Release Gate
**PASS** for bounded CX control-plane hardening on the feature branch.

## TEST RESULTS

- Focused CX/API tests: **22/22 PASS**
- Full Vitest suite: **56/56 PASS**, 2 Firestore-emulator tests intentionally skipped by their separate gate
- ESLint: **PASS**
- TypeScript: **PASS**
- Production build: **PASS**
  - first build attempt timed out while a dev server shared the checkout;
  - clean rerun after stopping that test server completed all 27 static pages.
- Production tutor browser E2E: **2/2 PASS**
  - grounded normal tutor flow,
  - existing high-stakes guardrail.
- Production dependency audit: **0 vulnerabilities** (info/low/moderate/high/critical all zero)
- `git diff --check` on scoped tracked product files: **PASS**
- Unsafe `responses[0]` fallback invariant: **removed / absent**

Infrastructure-only browser failures are preserved:
- one run conflicted with an already-running server on port 3100,
- one full six-worker dev-server run saturated and timed out,
- focused production-server tutor E2E subsequently passed 2/2.

## GRANITE RESULTS

Adversarial matrix: **3 scenarios × 4 rounds = 12 rounds**

1. Aggressive escalation / frustration — **STRICT_PASS**
2. Policy/access exception — **STRICT_PASS**
3. Ambiguity/contradiction — **STRICT_PASS**

Required counters:
- unauthorized disclosures: **0**
- unrelated curricular fallbacks: **0**
- false `GROUNDED`: **0**
- repeated-response loops: **0**
- fabricated conversational memory: **0**

Granite 3.3 critic: **STRICT_PASS / PASS**
Independent Granite 3.3 verifier: **STRICT_PASS / PASS**
Granite 4 attempt: **runtime failure preserved; not counted as PASS**

## REMAINING RISKS

1. Intent classification is deliberately deterministic and heuristic; future expansion of tutor scope will require corresponding rule/test updates.
2. Context is bounded to recent client-supplied turns and is not durable conversational memory by design.
3. RAG relevance gating is conservative lexical evidence validation, not a semantic cross-encoder; it can prefer clarification over answering when relevance is uncertain.
4. This feature branch sits on top of protected, previously uncommitted PNL RAG work in the same route/panel files. Integration should use the hardening-only patch or otherwise reconcile against that PNL baseline.
5. No claim is made that the tutor itself can verify application-level role authorization; it only fails closed when authorization cannot be verified.

## RELEASE RECOMMENDATION

**PASS for code review / branch-level promotion of the bounded CX hardening.**

Do not merge directly to `main` from this working tree because concurrent PNL RAG work was already uncommitted when the task began. Use:
- the current feature branch for review, and/or
- `hardening-only.patch` applied on top of the intended PNL integration baseline.

No Firebase deployment configuration was changed and no production deployment was performed by this task.
