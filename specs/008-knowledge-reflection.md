# SPEC 008 — Knowledge Reflection

## Objective

Add an inspectable Knowledge Reflection layer that can derive useful curricular connections from approved source material without allowing generated knowledge to overwrite source truth, silently update the Learning Twin, or surface high-stakes claims as verified facts.

## Product hypothesis

A learning system becomes materially more useful when it can reason across the curriculum, identify connections, gaps, and contradictions, and make those derived artifacts available to retrieval and instructors with explicit provenance and human review.

The learner remains the primary object. Reflection improves the curriculum and retrieval context; it does not become an autonomous authority over learner state.

## User outcomes

### Learner

- receives tutor answers grounded in approved course material;
- can benefit from approved cross-source reflections for conceptual questions;
- sees when an answer is connected to a derived reflection;
- is protected from blocked, draft, or high-stakes derived claims.

### Instructor / curriculum owner

- can inspect raw sources separately from derived artifacts;
- can generate a draft reflection from approved sources;
- can inspect novelty, connection, gap, confidence, pipeline version, prompt version, and lineage;
- can approve or block a derived artifact;
- can test how retrieval ranking changes by intent.

## Knowledge artifact model

Each artifact records:

- immutable identifier;
- corpus identifier;
- kind: raw source, reflection, summary, or quality finding;
- body plus optional novelty, connection, and gap;
- source artifact IDs;
- inspectable source references with exact locators;
- review status;
- confidence;
- high-stakes classification;
- learner visibility;
- tags;
- pipeline version;
- prompt version for derived artifacts;
- creation timestamp.

## Authority boundaries

1. Raw course sources remain authoritative.
2. Derived artifacts require source lineage.
3. Draft and blocked artifacts never surface to learner retrieval.
4. High-stakes artifacts never surface to learner retrieval.
5. Reflection execution has `stateAuthority = none`.
6. Reflection approval never updates mastery, confidence, goals, or recommendations directly.
7. Learner-state changes continue to require accepted learning events.
8. High-stakes health claims require external evidence and qualified review before they can ever become approved learner-facing knowledge.

## Retrieval policy

### Factual intent

Prefer raw approved source material.

### Conceptual intent

May prefer approved reflections or summaries when they connect multiple approved sources and preserve provenance.

### Curriculum-review intent

May expose drafts, blocked findings, gaps, and high-stakes quality findings for instructor review.

## Tutor integration

The tutor response contract may include:

- source evidence;
- reflection metadata;
- trust status;
- learning move.

If a query matches a high-stakes unsupported claim from the showcase corpus, the tutor must:

- avoid presenting it as verified medical fact;
- explicitly state the evidence boundary;
- expose the source location;
- use a blocked trust status;
- recommend qualified professional help where appropriate.

## Showcase implementation boundary

The current reflection generator is a deterministic showcase adapter. It proves:

- artifact lifecycle;
- provenance;
- review gating;
- intent-aware retrieval;
- tutor integration;
- non-authority over learner state.

A production provider-backed reflection worker remains a controlled extension and must preserve the same contracts.

## Acceptance criteria

1. `/studio/reflections` renders a usable Curriculum Reflection workbench.
2. The workbench distinguishes raw source, reflection, summary, and quality findings.
3. Generating a reflection produces a draft artifact and execution receipt with no learner-state authority.
4. A human can approve or block a non-high-stakes derived artifact.
5. A high-stakes artifact cannot be approved from the showcase UI.
6. Factual retrieval prioritizes raw source.
7. Conceptual retrieval can use approved reflections.
8. Draft, blocked, high-stakes, and quality findings are excluded from learner retrieval.
9. Every derived artifact has source lineage and prompt/pipeline version.
10. The learner tutor exposes approved reflection context where relevant.
11. The tutor blocks an unsupported high-stakes health claim.
12. Unit tests cover ranking, lineage, consolidation, visibility policy, and Twin authority separation.
13. E2E tests cover the reflection lifecycle and high-stakes tutor behavior on desktop and mobile.
14. Automated WCAG A/AA checks include the reflection route.
15. Production build, typecheck, lint, unit tests, E2E, browser smoke verification, security audit, and visual layout audit pass before release.

## Out of scope for this increment

- autonomous web research;
- automatic high-stakes fact approval;
- provider-specific model lock-in;
- persistent multi-tenant review workflows;
- server-side event storage;
- voice tutoring;
- commerce;
- certification authority.

## Release semantics

Producer → Critic → Fixer → Independent Verifier → Release Gate → Evidence.

The feature is complete only when the Graph Harness nodes reach `done` with persistent evidence.
