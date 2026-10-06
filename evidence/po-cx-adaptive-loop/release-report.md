# LUMA PO/CX Adaptive Loop — Release Evidence

Date: 2026-10-05
Branch: `feature/client-ready-learning-intelligence`

## Release decision

**PASS_WITH_RISKS for client demo.**

The previously reproduced PO blocker is closed: LUMA now turns onboarding signals and learning evidence into materially different Next Best Learning Actions in the learner-facing experience.

The remaining material risk is architectural, not CX-blocking for the current demo: learner state and the latest evidence event are still persisted browser-locally rather than in a durable multi-user learner-state service.

## Graph Engineering execution

1. **Producer** — connected onboarding, projected LearnerState, goal-aware ranking, evidence application, dynamic CTA destinations, journey projection and learner-visible route-change feedback.
2. **Critic** — browser acceptance and Granite adversarial review.
3. **Fixer** — replaced React effect-driven localStorage hydration with `useSyncExternalStore`; restarted a stale Next dev process after evidence exposed cache inconsistency.
4. **Verifier** — unit tests, canonical A/B/C Playwright tests, full showcase regression, WCAG sweep, production build, clean browser console and Granite verifier.
5. **Release Gate** — PASS_WITH_RISKS.
6. **Evidence** — this folder.

## Canonical learner acceptance

### Learner A — limited time / emotions
- Goal: Gestionar mejor mis emociones
- Diagnostic: correct P.A.S. recognition
- Available time: 8 min
- Next action: **Distingue evento, pensamiento y emoción**
- Destination: `/learn/experience/pas-detectar-y-reformular`
- Action length: 7 min

### Learner B — communication
- Goal: Comunicarme con más claridad
- Diagnostic: does not demonstrate P.A.S. recognition
- Available time: 35 min
- Next action: **Practica congruencia en tres canales**
- Destination: `/learn/experience/congruencia-tres-canales`

### Learner C — beliefs with prerequisite gap
- Goal: Transformar creencias que me frenan
- Diagnostic: prerequisite gap
- Available time: 20 min
- Next action: **Detecta un P.A.S. en una situación real**
- Destination: `/learn/session/pas`
- Product behavior: does **not** skip directly to the beliefs simulation.

## Evidence-driven route change

Before evidence:
- Next action: **Detecta un P.A.S. en una situación real**
- Destination: `/learn/session/pas`

Evidence:
- `SIMULATION_COMPLETED`
- concept: `pas`
- correctCount: `3`
- attempts: thought=1, emotion=1, reframe=1

After evidence:
- Next action: **Lleva la distinción a una creencia real**
- Destination: `/learn/experience/creencias-evidencia-e-interpretacion`
- Visible learner feedback: **Tu ruta cambió con la evidencia**
- The previous P.A.S. practice is not repeated.

## Automated gates

- ESLint: **PASS**
- TypeScript: **PASS**
- Unit tests: **25/25 PASS**
- Adaptive-loop Playwright: **4/4 PASS** (Chromium desktop + mobile)
- Product showcase Playwright: **17/17 PASS** (Chromium)
- WCAG automated sweep: **PASS**
- Next.js production build: **PASS**
- Browser console errors during direct adaptive acceptance: **0**

## Granite adversarial review

Granite 3.3 critic returned a textual **PASS** on the implemented loop.

Important verifier note: the critic also emitted internally weak scoring (all categories reported as 1/10 while saying PASS), and the compact Granite verifier incorrectly called that self-consistent. Therefore the Granite textual verdict is treated as supporting evidence, **not** as the release authority.

Release authority is the reproducible browser evidence and automated acceptance gates above.

## Product changes

- `src/lib/learner-projection.ts` — maps onboarding + evidence into learner state and a recomputed plan.
- `src/lib/learning-engine.ts` — adds goal focus and stronger prerequisite treatment.
- `src/lib/luma-data.ts` — adds adaptive candidate actions with semantically correct destinations.
- `src/components/adaptive-learning-home.tsx` — learner-facing adaptive projection using `useSyncExternalStore`.
- `src/components/next-action-card.tsx` — dynamic kind, rationale, confidence and destination.
- `src/components/onboarding-experience.tsx` — previews the real computed first action and clears stale evidence for a new learner.
- `e2e/adaptive-loop.spec.ts` — canonical A/B/C and evidence-driven route-change acceptance.
- `src/lib/learner-projection.test.ts` — deterministic projection tests.

## Remaining risks / next production step

1. **Durability (major for production, non-blocking for demo):** move learner state and evidence from browser-local storage into authenticated persistent learner records.
2. **Evidence history:** store an append-only event history rather than only the latest browser event.
3. **Cross-device continuity:** recompute the same Learning Twin projection from server-side evidence.
4. **Coach/learner consistency:** feed the same durable state into Studio so coach intelligence and learner Next Best Action share one authoritative state.

The P0 CX gap from the previous PO review is closed.
