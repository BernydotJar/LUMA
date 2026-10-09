# LUMA — Enterprise Architecture Acceptance Matrix (9 Oct 2026)

Source: inspected `origin/main` at `e819b16`; fixes in separate `audit/commerce-enterprise-20261009` worktree. This matrix distinguishes source-level capability from actual merchant activation and runtime proof.

| Definition of Done requirement | Classification | Proof / outstanding work |
| --- | --- | --- |
| Hotmart produces normalized commerce events | VERIFIED — source | `src/lib/commerce/providers/hotmart.ts`; Hottok + lifecycle unit tests |
| Stripe produces the same normalized domain event | VERIFIED — source | `src/lib/commerce/providers/stripe.ts`; HMAC + lifecycle unit tests |
| Repeated events are idempotent | VERIFIED — source, emulator conditional | `src/lib/commerce/ledger.ts` and `orchestrator.emulator.test.ts` |
| Payment → one purchase-scoped entitlement | VERIFIED — source, emulator conditional | Stable hashed identity, Firestore transaction |
| Entitlement → one durable enrollment | VERIFIED — source, emulator conditional | `commerceEnrollments` keyed by entitlement |
| Enrollment initializes a Twin | PARTIALLY VERIFIED | Verified Firebase identity claim plus separate onboarding `learningStore.bootstrap`; NOT automatic on payment |
| Refund and revocation alter access | VERIFIED — source, provider sandbox pending | Entitlement transition + effective enrollment predicate; cancelled paid-through periods |
| Provider-specific payloads absent from learning domain | VERIFIED — source | Adapters emit `NormalizedCommerceEvent` |
| Tenant isolation | PARTIALLY VERIFIED | Scoped Twin document tree and coach/learner authorization unit tests; Firestore emulation, backend RAG isolation and live red-team still required |
| Hotmart/Stripe signatures checked | VERIFIED — source, merchant sandbox pending | Hottok comparison and Stripe raw-body HMAC |
| Event observability and why access exists | VERIFIED — source, integration pending | Ledger correlation, privileged `/api/commerce/admin/access-trace` |
| Failure paths tested | PARTIALLY VERIFIED | Unit/emulator tests; actual provider failures and outage injection NOT YET VERIFIED |
| Current vs target architecture | VERIFIED — docs | `solution-architecture.md` and `production-readiness-and-sla.md` |
| Capacity and price separately bounded | VERIFIED — documentation; load NOT YET VERIFIED | `capacity-concurrency.md` |
| Configurable comparison accepts actual merchant rates | VERIFIED — code/tests; actual fees UNKNOWN | `economics.ts` has no hidden customer rates |
| Executive proposal and commercial strategy | VERIFIED — draft | `executive-proposal.md`, `commerce-strategy.md` |
| Pilot charter | VERIFIED — draft, client approval NOT YET VERIFIED | `pilot-charter.md` |
| Security/privacy/reliability brief | VERIFIED — draft; operational controls NOT YET VERIFIED | `security-privacy-reliability.md` |
| Learning Twin evidence-backed | PARTIALLY VERIFIED | Scored practices and learner store; payment alone must not create mastery |
| Learner risk explainable | VERIFIED — source unit tests; effectiveness NOT YET VERIFIED | Rule-based inactivity/practice, `insufficient_evidence` state |
| Coach prioritized around actionable need | PARTIALLY VERIFIED | Sample-based 100/8 intervention API; not a full-tenant census |
| Knowledge retrieval with video timestamp and provenance | PARTIALLY VERIFIED | LUMA-064 implements dedicated backend, HMAC-granted scopes, forced PostgreSQL RLS and pre-ranking exact pgvector filtering; local integration and TypeScript contract tests pass, but production backend/SE corpus/right-to-index are NOT YET VERIFIED |
| Fully operational Stripe Checkout creation | NOT YET VERIFIED | Webhook ingest exists but direct checkout creation is not implemented |
| Manual/bulk non-purchase enrollment | NOT YET VERIFIED | Conceptual extensibility, no audited public adapter |
| Provider test-mode products and signatures live | NOT YET VERIFIED | Merchant credentials, product mapping, signed full integration receipts not inspected |
| Technical concurrent learners, programs and 100–5,000 costs | NOT YET VERIFIED | Load/soak + actual billing required |
| Backup/restore, RTO/RPO and commercial SLA | NOT YET VERIFIED | Recovery drill, monitoring, customer contract not supplied |
| Independent Graph Harness verification | EVIDENCE RECORDED / BLOCKED for pilot | Separate technical and operational release gates; no green enterprise release absent external proof |

**Release interpretation:** Code-level audit improvements may ship after their own test/review gates. The **Seres enterprise pilot readiness gate must remain BLOCKED** until real-data route authorization, merchant sandbox operations, measured resilience, consent/data rights, reconciliation, and customer acceptance are validated.
