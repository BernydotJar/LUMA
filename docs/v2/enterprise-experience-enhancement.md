# LUMA — Enterprise experience boundary (2026-10-09)

## Product decision
Customer-facing LUMA describes learning outcomes, the person's current situation and the next action. Technical release graphs, model versions, content-ingestion inventories, private asset quantities, candidate media, QA receipts and unresolved approval gates remain in engineering evidence rather than in user-facing screens.

## Findings grounded in the supplied Spanish transcripts
1. "Así es la nueva educación impulsada por AI": short entry assessments, contextual responses, situated practice, retry after specific feedback, and enterprise learning tied to a business metric.
2. "Cómo AI destruyó los salones de clase": concern that completing AI-assisted assignments is not equivalent to independent understanding; recommendation to tutor via guided questioning and independent evaluation rather than always giving answers. Numerical/scientific claims in the transcript have not been externally verified.
3. "AI está matando la empresa tradicional": source capture, company-specific learning paths, AI governance, iterative feedback loops and measurable outcome-oriented organizational improvement. The transcript's business-growth percentages are not adopted as product claims.

## Surface boundaries
- Learner: present goal, capability, practice, observable evidence and next relevant action.
- Coach: present authorized participants, available evidence, next intervention and uncertainty.
- Organization: never claim whole-tenant coverage from a sampled API response.
- Content manager: show controlled content updates and source review, but no prompt/pipeline version in default UI.
- Engineering: keep development milestones, Graph Harness events, generated-asset rights review and private inventory sizes in restricted workflows.

## Changes in this increment
- Replace development gallery in /experience with appearance selection, semantic learning benefits, role navigation and real actions.
- Refocus /iconography on organization appearance and end-user meaning, not SVG or animation pipeline.
- Replace misleading static metrics and fabricated learner rows in /studio with authenticated data where available, honest access/empty/error states and clear sample qualifiers.
- Make /library about available study experiences, relevant concepts and program themes rather than an ingestion audit.
- Present class contracts in /studio/class-intelligence as learning objectives and evidence expectations.
- Hide AI pipeline and prompt identifiers in the content review UI while keeping the audit values in underlying artifacts.
- Add Playwright regression checks for customer-surface wording and fictional management numbers.

## Scope and release controls
The docs/transcripts inspired these modifications; the present increment **does not** implement new telemetry, automatic course production, voice cloning, payment activation or a new learning algorithm. It must not be described as a completed enterprise pilot or validation of business impact.

Graph Engineering sequence:
Producer (this bounded change) → Critic (copy, product and a11y) → Fixer → Independent Verifier (Playwright, lint, typecheck, tests, build, security) → Release Gate → evidence.

Pre-merge conditions: all checks green; new and updated Playwright assertions match the rendered UI; authorized coach record APIs remain protected; no fictional metrics are introduced; preserve existing Firebase endpoints; security and provenance rules unchanged. Do not publish until these conditions are met.
