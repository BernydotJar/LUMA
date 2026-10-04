# Release Decision

Release: **LUMA Product Showcase Release 0.1.0**
Decision date: 2026-10-04
Decision: **PASS — release for client demonstrations**

## Decision statement

LUMA may be shown to prospective clients, instructors, creators, partners, and technical stakeholders as a functioning AI-native Learning Intelligence product.

It may not yet be represented as a fully deployed, multi-tenant production service with completed video ingestion, persistent learner event storage, enterprise identity, live model-provider RAG, commerce, or operational support SLAs.

## Why this is a product showcase—not a static demo

The release supports complete user actions:

- learner goal and diagnostic calibration;
- deterministic best-next-action decision;
- visible recommendation rationale;
- source-backed tutor interaction;
- guided practice with feedback;
- creation of a learning-event receipt;
- Learning Twin inspection, correction, export, and simulation;
- content and graph inspection from a real source slice;
- instructor bottleneck analysis and human-intervention assignment.

Controls used in the recommended demo path produce visible state changes or navigation. The system includes recovery states, mobile behavior, accessibility coverage, and evidence-backed release gates.

## Release gates

| Gate | Required | Result |
|---|---:|---:|
| Lint | Yes | PASS |
| TypeScript | Yes | PASS |
| Unit tests | Yes | PASS — 4/4 |
| Production build | Yes | PASS |
| Desktop E2E | Yes | PASS — 6/6 |
| Mobile E2E | Yes | PASS — 5/5 |
| Automated accessibility | Yes | PASS |
| Visual geometry | Yes | PASS — 12/12 |
| Browser errors | Yes | PASS — 0 |
| Production dependency audit | Yes | PASS — 0 vulnerabilities |
| Critic review | Yes | PASS after repairs |
| Independent verification | Yes | PASS |
| Graph Harness ledger | Yes | PASS / COMPLETED |

## Approved demo claims

- “LUMA centers the learner and their goal rather than the course module.”
- “The Learning Twin separates observed, self-reported, and inferred evidence.”
- “The recommendation engine can skip known material and remediate repeated failure.”
- “The tutor experience exposes source evidence for the selected corpus slice.”
- “The practice flow creates a learning-event receipt.”
- “The instructor view surfaces concept bottlenecks and human-intervention needs.”
- “The selected Module 3 corpus is real and source-linked.”
- “The product has passed automated build, behavior, accessibility, layout, and production-dependency security gates.”

## Claims that require qualification

- “AI tutor” — currently a structured, interactive, source-backed showcase adapter; full provider-backed RAG is architected but not connected.
- “Persistent Learning Twin” — the product model and interactions are complete; showcase state is browser-local, while server persistence is architected.
- “Content ingestion” — Module 3 is inventoried and the PDF structure is used; video transcription is pending.
- “Learning Quality Score” — the UI demonstrates decomposed quality logic; production computation requires full processing and reviewer workflow.
- “Prediction” — trajectory simulation is illustrative and explicitly assumption-bound.

## Demonstration policy

Before a client session:

1. use a clean browser profile or clear LUMA local storage;
2. open the deployed preview or run the production build locally;
3. follow the README demo path;
4. state the showcase boundary before technical due diligence;
5. avoid opening source Drive assets unless the audience is authorized;
6. never claim the support-book ZIP has approved ingestion rights;
7. never describe Twin inference as diagnosis or objective truth.

## External blockers for a production pilot

- approved production hosting account and domain;
- identity provider and tenant policy;
- PostgreSQL/pgvector and object storage;
- event bus/queue and workers;
- model, speech, and embedding provider credentials/policy;
- source-content rights review;
- production observability, backup, deletion, and incident response;
- manual accessibility review;
- customer-specific data processing and security review.

These blockers do not prevent client demonstrations. They do prevent representing the release as generally available production software.

## Final release label

**LUMA 0.1.0 — Product Showcase Release**

Functional. Source-backed. Explainable. Quality-gated. Ready to show.
