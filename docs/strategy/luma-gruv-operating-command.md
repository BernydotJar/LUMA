# LUMA / GRUV — Operating Charter (2026-10-10)

**Decision:** one LUMA Core, one LUMA Platform, multiple institutional experiences and optional vertical product shells. **GRUV** replaces the earlier working name GROOVE for the proposed professional-language experience. Seres de Excelencia remains the first institutional priority. No permanent repository fork and no dual-maintained learning engine.

## Inputs and scope

- User-supplied product strategy: one shared learning core; sell a configurable SaaS to organizations; later create a dedicated language app using the same engine; verified learning evidence and adaptive decisions are the differentiation.
- User-supplied Spanish transcript of a technical book-review video: emphasizes the reliability/scalability/maintainability triangle, explicit trade-offs, data access patterns/indexes, bottlenecks, distributed failure modes and event-driven processing. The **full book was not provided**; this charter interprets the supplied summary rather than citing pages from the book.
- Current implementation: Next.js/Firebase learning routes; program-scoped Twin and entitled learning; commerce and scoped retrieval interfaces; Seres branding and representative PNL fixtures remain present.

## Product outcome

A product owner can demonstrate that two people and two organizations receive appropriately different experiences from the same evidence-driven engine. The learner sees a next meaningful learning action and verified progress. The coach sees authorized evidence, confidence, provenance and human-intervention opportunities. The institution sees quality, admissions, costs and governance.

### Product boundaries

| Area | Responsibility | Explicit exclusions |
| --- | --- | --- |
| LUMA Core | Learning evidence, Twin projections, assessments, adaptive next action, domain services | Institutional logos, PNL-specific business rules, direct payment-provider dependency |
| LUMA Platform | Tenant setup, brands, programs, entitlements, metering, roles and governance | Trusting a client-provided tenant selection without independent authorization |
| Seres de Excelencia | Authorized programs, coach workflows, brand, content, institutional configuration | Becoming the default for unknown SaaS organizations |
| GRUV | Language goals, CEFR-aligned experimental competency mapping, speech practice and simulations | New learning engine, default access to Seres data, unverified CEFR certification claims |

**Naming:** GRUV is a selected product working name; trademark/domain clearance and brand asset rights require separate checks before commercialization.

## Shipping in parallel, not splitting the codebase

A. **Customer track (SE):** finish current production journeys, learning reliability, live classes, certificates, coach and learner experience. Do not derail customer gates.

B. **Core track:** extract neutral boundaries only when a tested second use case requires them; refactor by compatibility-preserving small changes.

C. **SaaS track:** tenant and program administration, trusted membership, self-service configuration, resource quotas, commerce entitlements, isolation and audit. GRUV then becomes a separate shell and commercial offer.

Use small Git branches and reviewed PRs into a protected `main`; a dedicated UI repository is optional only once independent deployment and product cadence justify the cost. Preserve the exact-SHA release pipeline and avoid enabling new production tenancy as a byproduct of a UI feature.

## Data-intensive engineering principles as product requirements

1. **Reliability:** define failure behavior for each boundary: authorization, storage, payment, AI response, video, live classroom and email. A failing tutor must not erase an entitlement or manufacture a mastered competency.
2. **Scalability:** document expected read/write distribution and hot queries before choosing indexes, caches or queues. Measure realistic concurrent activity and per-active-learner cost; do not invent performance guarantees.
3. **Maintainability:** version contracts, keep one authoritative event/evidence model, avoid tenant-specific forks and use minimal interfaces with regression tests.
4. **Data integrity:** persist source evidence distinctly from inferred/projection state; use immutable IDs, UTC timestamps, and reproducible projections. Handle duplicate event delivery, retries and out-of-order arrivals before advertising durable distributed ingestion.
5. **Consistency trade-offs:** authorization, payment and enrollment decisions require reliable authoritative state; derived analytics can be asynchronous and eventually consistent with visible freshness indicators.
6. **Distribution:** choose asynchronous processing for long ingestion/transcription, notifications and projections where appropriate; don't add Kafka or extra microservices without concrete load and recovery evidence.
7. **Recovery:** define audit trails, replay, backups, retention and deletion/export; verify cross-tenant data boundaries at rest and at retrieval time.
8. **Observability:** collect safe correlation IDs, job outcome, retry state and error categories; avoid exposing Twin inferences or private content in public telemetry.

## Sequenced product gates

| Gate | Deliverable | Exit criteria |
| --- | --- | --- |
| GRUV-001 | Institutional product/brand contracts | Seres visuals unchanged; GRUV defined as disabled product shell; fail-closed tenant/program lookup; tests and architecture spec |
| GRUV-002A | Disabled draft configuration and audit | Local source-only, versioned drafts, tenant-admin isolation, transaction retry, emulator verification and independent review |
| GRUV-002B | Publication readiness inspection | A trusted read-only preflight validates scoped active offerings, tenant identity, bounded scan and program completeness; never activates a tenant |
| GRUV-002C | Governed publication plans (source-only) | Prepare, independent platform review, emergency withdrawal, atomic revision history and idempotent receipts; no live activation or production rollback |
| GRUV-002 | True institutional control plane | Server-verified tenant membership, dynamic brand/program configuration, RBAC, admin audit, isolation tests and recovery |
| GRUV-003 | End-to-end second-institution acceptance | Two independently authorized organizations, different approved content, Twin events, retrieval and payments isolated |
| GRUV-004 | GRUV language vertical | Calibrated diagnostic, reusable Twin, situational practice, voice guardrails and evidence-based progression |
| GRUV-005 | Commercial readiness | Measured costs, billing reconciliation, privacy, incident/runbook, SLO and independent production acceptance |

**Important:** GRUV-001 does not activate GRUV, replace `LUMA_LEARNING_TENANT_ID`, create live customer credentials or prove production multi-tenancy. Those remain follow-on gates.

## Operating command for agents

For every `/loop <outcome>` in this project, use the active repo and Graph Harness methodology, execute only while tools are available, and report a terminal status of `COMPLETED`, `PARTIAL_WITH_DOCUMENTED_BLOCKERS` or `SAFETY_STOP`. Never claim work continues outside the interaction. Keep evidence of Observe, Spec, Producer, Critic, Fixer, Independent Verifier and Release Gate. A failed verification is recorded and fixed, not hidden.

## North Star and guardrails

- **North Star:** verified improvement in demonstrated capability per effective learning time, with transparent measurement limits.
- **Guardrails:** zero unauthorized cross-tenant access; no evidence-free mastery; no private content leakage; customer-visible regression monitored; controllable AI cost per active learner; recoverability and support availability.
- **Release:** unit/emulator/build/E2E/security/a11y and independent review gates according to changed risk. A clean local unit suite is not by itself approval to merge or deploy.
