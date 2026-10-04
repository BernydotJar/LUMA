# LUMA

**Learning intelligence, centered on the learner—not the module.**

LUMA is an AI-native learning product built around a persistent, explainable **Learning Twin**. It understands a learner's goal, current evidence, weak prerequisites, time available, confidence, and recent interventions, then recommends the best next learning action.

> LUMA knows how you learn. You decide where you are going.

## Product Showcase Release

This branch is a complete, client-ready product showcase rather than a static concept or a collection of dead-end screens.

It includes:

- a commercial product narrative and responsive marketing experience;
- goal-first learner onboarding and diagnostic calibration;
- a functioning learner home centered on one next action;
- deterministic, unit-tested recommendation logic;
- an interactive source-backed tutor;
- a guided practice that creates a real learning-event receipt;
- an inspectable Learning Twin with evidence categories, confidence, correction, export, and trajectory simulation;
- a source-backed content intelligence and curriculum graph view;
- an inspectable Knowledge Reflection workbench with provenance, review gates, intent-aware retrieval, and high-stakes claim blocking;
- an instructor Learning Studio with bottlenecks, curriculum quality, intervention evidence, and assignable human escalation;
- loading, error, empty/recoverable, mobile, and accessibility states;
- product, architecture, specification, research, QA, security, and release evidence.

The experience is powered by a real selected corpus slice from the Practitioner program: **Module 3 — Redescubriendo y transformando tu poder**.

## Product routes

| Route | Product moment |
|---|---|
| `/` | Product positioning and client-facing story |
| `/onboarding` | Goal, diagnostic, confidence, time, initial Twin |
| `/learn` | Learner home and best next action |
| `/learn/session/pas` | Guided practice and evidence receipt |
| `/twin` | Explainable Learning Twin |
| `/library` | Content Intelligence and curriculum graph |
| `/studio` | Instructor Learning Intelligence |
| `/studio/reflections` | Curriculum Reflection, provenance, review, and retrieval policy |
| `/api/reflections` | Structured reflection showcase adapter |
| `/api/tutor` | Structured tutor showcase adapter |

## Recommended client demo — 8 minutes

1. **Start at `/`** — explain that the primary object is the learner, not the course.
2. **Open `/onboarding`** — choose the goal “Transformar creencias que me frenan,” answer the diagnostic, report confidence, and choose 12 minutes.
3. **Enter `/learn`** — show the goal, verified progress, and the single best next action.
4. **Open “¿Por qué esto?”** — point out observed evidence, inference, uncertainty, and what would change the route.
5. **Ask the Tutor** — “¿Qué es un P.A.S.?” and show the source-backed answer.
6. **Run `/learn/session/pas`** — complete the three-step scenario and show the `SIMULATION_COMPLETED` evidence receipt.
7. **Open `/twin`** — inspect observed, inferred, and self-reported evidence; demonstrate correction and export.
8. **Open `/studio/reflections`** — generate a draft reflection, inspect its lineage, approve it with a receipt, and switch retrieval intent.
9. **Finish in `/studio`** — select a bottleneck, compare intervention effectiveness, and assign a human follow-up.

Optional technical close: open `/library` to show the real corpus manifest, content states, provenance, graph, and Learning Quality components.

## What is real in this release

- real Next.js product routes and interactions;
- real deterministic recommendation engine;
- real unit and end-to-end tests;
- real structured tutor endpoint and client interaction;
- real learning-event receipt written by the practice flow;
- real Learning Twin correction and export interactions;
- real source IDs and links for the selected Google Drive corpus;
- real accessibility, layout, build, browser-error, and security evidence;
- real product and production architecture boundaries.

## Controlled production extensions

The product deliberately does **not** claim that credentials, multi-gigabyte video ingestion, production identity, persistent event storage, model-provider RAG, commerce, or enterprise tenancy are complete. Those seams are designed and documented:

- browser-local showcase events → authenticated append-only event API;
- deterministic corpus fixtures → PostgreSQL/pgvector read models;
- source manifest → resumable object-storage ingestion workers;
- tutor adapter → retrieval, structured orchestration, citation validation, and provider policy;
- local Twin projection → versioned server projection from accepted events;
- showcase cohort → tenant-scoped identity, roles, and privacy thresholds.

See [`architecture/system-context.md`](architecture/system-context.md) and the seven specifications in [`specs/`](specs/).

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Motion
- Lucide icons
- Vitest
- Playwright
- axe-core accessibility testing
- Graph Harness SDLC evidence ledger

Target production architecture:

- PostgreSQL + pgvector
- object storage
- queue/event bus and idempotent workers
- provider-portable LLM, speech, and embedding adapters
- versioned curriculum graph abstraction
- append-only learning events and rebuildable Twin projections

## Local setup

Requirements:

- Node.js 22+
- npm 10+

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run test:e2e
node scripts/visual-audit.mjs
```

Run the visual audit while the application is available on `http://127.0.0.1:3100`.

## Verified release signals

- TypeScript: pass
- ESLint: pass
- unit tests: 10 pass
- Playwright: 15 pass; one mobile duplicate accessibility sweep intentionally skipped
- WCAG A/AA automated sweep: pass on key client-facing routes
- desktop/mobile route layout audit includes Knowledge Reflection; horizontal overflow target: 0
- clipped text findings: 0
- browser console/page errors in captured routes: 0
- production dependency audit: 0 vulnerabilities
- production build: required in the final release gate

The five current full-audit alerts are confined to the Next.js ESLint development dependency chain. `npm audit --force` would downgrade the application to an incompatible Next.js major version, so the risk is documented rather than hidden behind a destructive automated fix.

## Evidence

- `evidence/verification/` — lint, typecheck, unit, build, E2E, accessibility, npm audit, and layout audit outputs
- `evidence/visual/` — compact desktop/mobile contact sheets and browser error records
- `evidence/critic-review.md` — attempted falsification and repaired findings
- `evidence/independent-verification.md` — acceptance and quality verification
- `evidence/release-decision.md` — release boundary and decision
- `graph-harness.project.json` / `graph-harness.events.jsonl` — typed project graph and append-only evidence ledger

## Documentation

- [`docs/product-thesis.md`](docs/product-thesis.md)
- [`docs/content-inventory.md`](docs/content-inventory.md)
- [`docs/learning-model.md`](docs/learning-model.md)
- [`docs/research/competitive-pain-matrix.md`](docs/research/competitive-pain-matrix.md)
- [`docs/strategy/niche-learning-app-portfolio.md`](docs/strategy/niche-learning-app-portfolio.md)
- [`specs/008-knowledge-reflection.md`](specs/008-knowledge-reflection.md)
- [`architecture/`](architecture/)
- [`specs/`](specs/)

## Trust model

The Learning Twin separates:

- **Observed** — a verifiable interaction or result;
- **Self-reported** — information intentionally provided by the learner;
- **Inferred** — a hypothesis with confidence, evidence, and policy version.

LUMA never treats course completion as mastery, never silently publishes AI-generated curriculum, and never grants a model direct authority over certification, learner-state projection, commerce, or external effects.

## License

MIT. See [`LICENSE`](LICENSE).
