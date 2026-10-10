# ADR — LUMA Core with Institutional Experiences and GRUV

**Decision:** Shared modular monolith and short-lived branches, not a long-lived fork or premature microservice split. First incremental extraction is source-compatible.

```text
             LUMA PLATFORM (trusted organization administration)
                      |
        +-------------+-------------+
        |                           |
   Seres experience             GRUV languages (planned)
   PNL/coaches/live             scenarios/voice/CEFR mapping
        |                           |
        +-------------+-------------+
                      |
             LUMA CORE (one implementation)
 identity/entitlement -> scoped learning events -> Twin projection
                                    |             |
                             next best action  coach evidence
                                    |
                          corpus-scoped retrieval
```

## Identity is not appearance

`themeId`, `brand`, `productShellId` and `tenantId` are different concepts. Branding cannot authorize a request. A trusted server resolves tenant and program from verified identity/membership/entitlement before accessing the learner state or proprietary retrieval index. Configuration lookup follows that result, never the reverse.

## State and events

- **Authoritative writes:** Firestore scoped records are already in use for enrolled learners; purchase/entitlement data determines access. Never replace this with a UI configuration.
- **Learning evidence:** preserve observed source receipts separate from Twin projections, provide idempotency on event IDs and deterministic replay where possible.
- **Long processing:** media extraction, embeddings and aggregate analytics can evolve to versioned asynchronous jobs. Evaluate actual volume and failure recovery before choosing a broker or database.
- **Retrieval:** pgvector with pre-retrieval tenant filtering is designed in LUMA, but live enterprise isolation is gated. Do not share unrestricted embeddings between tenants.

## Trade-off record

| Choice | Benefit | Cost / risk | Current decision |
| --- | --- | --- | --- |
| Permanent fork | Initial design independence | Engine divergence, repeated security patches, inconsistent Twin | Reject |
| Separate microservices now | Deployment isolation | Distributed failure, tracing, ops and sync complexity | Defer |
| Shared modular monolith | One source, compatibility tests, lower ops burden | Requires boundaries and disciplined releases | Accept |
| One global default tenant | Easy demo | Cross-tenant data leakage and accidental fallback | Forbidden in entitled mode |
| Event-driven everything | Decoupled handlers | Duplicates, ordering, retries and extra infrastructure | Use selectively with durable receipts |

## Production boundary

The first increment creates versioned configuration contracts and preserves the Seres appearance. It does not introduce a tenant configuration database, trusted tenant switching, actual GRUV enrollment, GRUV website or GRUV speech evaluation. Those require GRUV-002/003/004 and independent proof.
