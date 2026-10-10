# LUMA

**Learning intelligence, centered on demonstrated capability—not course navigation.**

LUMA turns expert knowledge into individualized, measurable learning journeys. The coachee sees one relevant next action, understandable progress, practice, and contextual support. The coach sees the proprietary Learning Twin, evidence, bounded inference, confidence, provenance, and intervention context.

> The intelligence is the moat. Clarity is the experience.

## Client-showcase release

This branch is a working, client-ready product showcase deployed on Firebase App Hosting. It includes:

- positive, action-oriented coachee experience;
- separate Coach Intelligence workspace;
- proprietary Learning Twin with evidence and governance;
- grounded tutor and high-stakes claim blocking;
- guided practice producing a real learning-event receipt;
- Content Intelligence and curriculum relationships;
- controlled curriculum reflection;
- three global visual themes;
- superuser role/theme comparison console;
- theme-aware semantic iconography;
- andragogical progress narrative;
- glass-material adversarial verification;
- provider-neutral voice and private-video delivery plans;
- Graph Harness release evidence.

The current representative corpus is **Practitioner · Módulo 3 — Redescubriendo y transformando tu poder**.

## Themes

| Theme | Purpose | Primary visual language |
|---|---|---|
| **Seres de Excelencia** | Institutional expression | public-logo blue/pink and supporting plum; brand-owner approval pending |
| **Liquid Light** | Premium light experience | system-light surfaces, restrained lens behavior, active blue, teal and violet |
| **Nocturne Intelligence** | Deep work and analytical sessions | aubergine, champagne, burnt orange, sage and warm ivory |

Theme selection is persisted with `luma-theme-v1` in the showcase. Theme changes presentation, not learning logic, permissions, evidence, or source truth.

The SE palette is a **provisional interpretation of publicly accessible brand assets** and is **not an approved corporate palette**. See `docs/design/seres-brand-provenance.md`. The logo and related institutional assets remain the property of their owner and are not relicensed by the repository MIT license.

## Product routes

| Route | Product moment |
|---|---|
| `/` | Enters the coachee journey |
| `/experience` | Superuser console: roles, themes, iconography and delivery tracks |
| `/onboarding` | Goal, diagnostic, confidence and time calibration |
| `/learn` | Coachee home, best next action and capability progress |
| `/learn/session/pas` | Guided P.A.S. practice and evidence receipt |
| `/studio` | Coach Studio: cohort signals and human intervention |
| `/studio/learners/mariana` | Proprietary Learning Twin and coach evidence |
| `/twin` | Redirect to coach Learning Twin route |
| `/library` | Content Intelligence and curriculum relationships |
| `/studio/reflections` | Controlled curriculum reflection and provenance |
| `/iconography` | Six semantic meanings across all three themes |
| `/api/tutor` | Structured grounded tutor adapter |
| `/api/reflections` | Structured curriculum-reflection adapter |

## Recommended client demo — 10 minutes

1. **Start at `/experience`** — switch among SE, Liquid Light, and Nocturne; show coachee and coach together.
2. **Open the coachee view** — demonstrate the single next action and plain-language adaptation.
3. **Use “Tu progreso”** — compare demonstrated capability, transfer evidence, and next demonstration.
4. **Inspect “¿Por qué esta práctica?”** — show signal, bounded interpretation, and next evidence.
5. **Ask LUMA** — ask “¿Qué es un P.A.S.?” and show the grounded source response.
6. **Complete `/learn/session/pas`** — create `SIMULATION_COMPLETED` evidence.
7. **Open Coach Intelligence** — inspect observed, inferred, and self-reported evidence.
8. **Open `/studio`** — locate a cohort opportunity and assign human follow-up.
9. **Open `/library`** — show “De contenido experto a inteligencia de aprendizaje.”
10. **Open `/iconography`** — show stable meaning with theme-specific material.

## Andragogical progress

The coachee progress surface answers:

1. What can I do now?
2. Where did I apply it?
3. What will I demonstrate next?

It deliberately avoids points, streak manipulation, school-like badges, raw Twin scores, and completion-as-mastery.

## Iconography system

The deterministic production baseline contains **18 SVG assets**:

- six semantic meanings;
- three theme expressions.

Semantic meanings:

- Practice → refractive prism;
- Progress → orbital field;
- Coach Insight → architectural strata;
- Human Intervention → bridge / threshold;
- Voice → resonance field;
- Video → editorial frame.

The controlled animated-asset path is documented in [`docs/iconography/3dicon-pipeline.md`](docs/iconography/3dicon-pipeline.md). It requires:

1. exactly one still;
2. Product Owner approval;
3. one motion proposal;
4. separate motion approval;
5. alpha/loop/performance verification;
6. static reduced-motion fallback.

The workflow is inspired by the MIT-licensed `samyost1/3dicon` project. LUMA owns its semantic mapping, prompts, review receipts, generated assets, and release evidence.

## Voice boundary

The planned voice is an **original Seres Coach Voice**: mature Colombian/Latin American Spanish, warm, direct, reflective, and never patronizing.

A direct imitation or clone of an identifiable person is blocked unless explicit written authorization, intended-use scope, revocation terms, provider verification, and legal review are available.

Voice is approved only when speaking or listening is part of the learning objective. Text-only completion remains available.

See [`docs/voice/original-seres-coach-voice.md`](docs/voice/original-seres-coach-voice.md).

## Private video boundary

The private Drive corpus contains multi-gigabyte course videos. The first recommended controlled source is the approximately 1.27 GB Module 1 Class 2 MP4, subject to rights confirmation.

The planned pipeline is:

rights gate → immutable source receipt → media probe → representative segment → transcript/captions → concept alignment → private delivery → exposure event → follow-up transfer practice.

Watching video records exposure; it does not prove mastery.

See [`docs/video/showcase-runbook.md`](docs/video/showcase-runbook.md).

## What is real in this release

- real Next.js product routes and responsive interactions;
- real theme persistence and pre-hydration theme bootstrap;
- real coachee/coach information separation;
- real deterministic recommendation engine;
- real source-backed tutor endpoint;
- real learning-event receipt;
- real Learning Twin evidence and export interactions;
- real 18-asset deterministic iconography baseline;
- real three-theme glass adversarial harness;
- real accessibility, layout, build, browser, and security evidence;
- real Firebase App Hosting deployment;
- real Graph Harness release ledger.

## Controlled production extensions

The showcase does not claim completion of:

- production authentication and profile persistence;
- tenant-scoped theme policy;
- generated 3D WebP assets from Gemini/provider bridge;
- direct identifiable voice cloning;
- persistent voice/audio storage;
- private video transcode and signed streaming;
- durable event storage;
- provider-backed retrieval at enterprise scale;
- commerce or certification authority.

Those boundaries are specified and release-gated rather than hidden.

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Motion
- Lucide
- Vitest
- Playwright
- axe-core
- Firebase App Hosting
- Graph Harness SDLC

## Local setup

Requirements:

- Node.js 22+
- npm 10+

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3100
```

## Quality commands

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
env -u CI npm run test:e2e
node scripts/visual-audit.mjs
node scripts/glass-adversarial-audit.mjs
npm audit --omit=dev
```

Run browser audits while the application is available at `http://127.0.0.1:3100`.

## Verified release signals

- ESLint: pass
- TypeScript: pass
- unit tests: **16/16 pass**
- Playwright: **31 pass**, one intentional duplicate mobile accessibility skip
- WCAG A/AA: pass on client-facing routes
- standard layout audit: **22 route/viewport checks**, zero overflow/clipping/out-of-bounds findings
- glass adversarial audit: **30 theme/route/viewport checks**, zero blocking findings
- production dependency audit: **0 vulnerabilities**
- production build: pass

## Graph Harness

The delivery graph includes dedicated nodes for:

- theme/superuser architecture;
- SE institutional theme;
- Liquid Light theme;
- Nocturne theme;
- glass adversarial testing;
- iconography/3dicon pipeline;
- andragogical progress;
- original coach voice research;
- private video pipeline;
- themed client-showcase release.

See:

- `graph-harness.project.json`
- `graph-harness.events.jsonl`
- `evidence/graph-harness-status.json`

## Key documentation

- [`docs/product-thesis.md`](docs/product-thesis.md)
- [`docs/learning-model.md`](docs/learning-model.md)
- [`docs/content-inventory.md`](docs/content-inventory.md)
- [`docs/iconography/README.md`](docs/iconography/README.md)
- [`docs/design/source-guided-premium-system.md`](docs/design/source-guided-premium-system.md)
- [`docs/product-messaging-boundaries.md`](docs/product-messaging-boundaries.md)
- [`specs/012-theme-system-superuser.md`](specs/012-theme-system-superuser.md)
- [`specs/013-iconography-3dicon.md`](specs/013-iconography-3dicon.md)
- [`specs/014-progress-andragogy.md`](specs/014-progress-andragogy.md)
- [`specs/015-glass-adversarial-testing.md`](specs/015-glass-adversarial-testing.md)
- [`specs/016-original-coach-voice.md`](specs/016-original-coach-voice.md)
- [`specs/017-video-ingestion-showcase.md`](specs/017-video-ingestion-showcase.md)

## License

Application code is MIT-licensed. See [`LICENSE`](LICENSE). Third-party and institutional brand/media assets retain their original rights and are governed separately.


## Enterprise certification (feature branch)

LUMA's academic credential service adds coach-attested completion, frozen learner legal names, **institutional X.509 digital signing with private self-hosted Stirling-PDF as the default**, private signed PDFs and validation evidence, QR-based public verification, learner wallet, and administrative revocation. DocuSign remains an optional adapter for individual signer workflows.

- Coach console: `/studio/certificates`.
- Learner wallet: `/learn/certificates`.
- Verification: `/verify/{certificateId}`.
- Implementation, provider configuration and legal/release requirements: [Enterprise certification architecture](docs/enterprise/certificates-e-sign.md).
- Signing infrastructure: [Private Stirling deployment](ops/stirling/README.md).
- Verification and release decision: [Stirling integration gate](evidence/stirling-certificates-20261009/release-evidence.md), plus [certificate baseline evidence](evidence/certificates-esign-20261009/release-evidence.md).

**Branch-only capability; not a claim of production deployment.** An institutional signing certificate, explicit automated-signing authorization, verified Stirling build/license, private storage and networking, full CI build, cryptographic acceptance tests and legal approval are required before promotion.
