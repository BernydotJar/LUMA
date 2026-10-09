# LUMA Enterprise Decision Pack — 2026-10-09

**Commercial principle:** Hotmart + LUMA + Stripe where economically appropriate.

| Document | Decision |
| --- | --- |
| [Executive proposal](executive-proposal.md) | CEO, commercial and pilot |
| [Solution architecture](solution-architecture.md) | Provider-neutral integration and learning boundaries |
| [Security/privacy/reliability](security-privacy-reliability.md) | Controls, risks, privacy and recovery |
| [Commerce strategy](commerce-strategy.md) | Hotmart + optional Stripe, lifecycle and operations |
| [Capacity](capacity-concurrency.md) | Sizing and FinOps proof |
| [Pricing and financial model](pricing-financial-model.md) | Configurable merchant comparisons |
| [Pilot charter](pilot-charter.md) | 60-day baseline, ownership and acceptance |
| [Acceptance matrix](audit-acceptance-matrix.md) | Exact implementation status / blockers |
| [Learning access policy](learning-access-policy.md) | Optional fail-closed entitlement enforcement for pilot deployments |
| [Tenant/program isolation contract](tenant-isolation-contract.md) | Scoped Twin, coach permissions, provider RAG contract |
| [Institutional certificate signing](certificates-e-sign.md) | Private Stirling-PDF, trusted X.509 signature, ownership and license/release gates |

**Evidence classifications:** VERIFIED = source/tests/config directly observed; ESTIMATED = mathematical scenario based on inputs; ASSUMED = unconfirmed pilot hypothesis; NOT YET VERIFIED = external or operational evidence missing.

This public, reusable package intentionally omits customer-specific contracted terms, negotiated rates, names, private program content, and personal data. It is not a contractual SLA, quotation, merchant onboarding statement, or independently measured capacity claim.

Graph policy: Producer → Critic → Fixer → Independent Verifier → Release Gate → Evidence. Source code can be reviewed while the real-money enterprise pilot remains gated.

Security follow-up: [Scoped RAG backend requirements](scoped-rag-backend-requirements.md) and [adversarial follow-up](../../evidence/enterprise-commerce-audit-20261009/adversarial-followup-20261009.md). The external index and Granite review remain unverified.

New backend delivery: [LUMA-064 Scoped RAG](luma-064-scoped-rag.md) and [service README](../../services/scoped-rag/README.md). This is a tested source implementation, not a deployed production gateway.
