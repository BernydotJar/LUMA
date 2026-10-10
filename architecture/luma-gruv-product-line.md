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

## GRUV-002A — Draft control plane extension

The secure preparatory slice uses Firestore document transactions on `institutionConfigDrafts/{sha256(tenantId)}`. A single transaction commits both the new immutable configuration revision and an idempotency audit receipt. `configVersion` defines a per-tenant total update order; wall-clock timestamps are observability metadata, **not concurrency tokens**. This is an explicit DDIA trade-off: strong consistency for sensitive configuration writes, without requiring a distributed message broker.

The draft collection is not queried by learner entitlements and exposes no `getByTenantId()` implementation for the published-config interface. In particular, Seres de Excelencia's active experience cannot be affected by editing a GRUV draft. The route is disabled by default, and new tenant creation is platform-superuser-only. Dedicated `adminTenantIds` are mandatory for tenant-scoped draft updates; the legacy admin-claim fallback is prohibited in this new control plane.

A later publication/activation workflow will need authoritative program ownership, explicit approval, separate active configuration storage, append-only publication events/outbox, IAM testing, cross-tenant RAG proof, resource quotas, backup/restore and rollback. The source module is **not that publication workflow**.

## GRUV-002B — Read-only publication readiness (design follow-through)

The institutional draft store remains distinct from any active/published institution source. A standalone `FirestoreInstitutionPublicationInspector` reads draft metadata and program delivery offerings scoped by **both tenant and program**, checks identifiers/status, and returns local blockers plus unresolved enterprise gates. There is deliberately no `publish()` method and no endpoint that mutates tenant activation.

Firestore needs the composite `programOfferings(tenantId ASC, programId ASC, __name__ ASC)` collection index to execute the scoped query in production. The source index definition is present; deployment/migration are out of scope. Query limits are explicit (`51` records with over-cap detection at `50`), and the result does not falsely promise a transactionally stable view across independent reads. Digest tracks draft configuration and inspected offer IDs/statuses, but is advisory only, not a signature or authorization token.

The dedicated publication preflight flag is disabled by default, even when the separate draft-admin feature flag is enabled. This reduces blast radius and ensures security gates cannot be accidentally bypassed through institutional configuration/UI settings. A future publication mechanism requires authoritative revalidation under concurrency control, explicit external approval, rollback receipts, IAM validation, tenant-bound RAG proof and operational readiness. This architecture favors maintainable isolation and fail-closed correctness over premature distributed microservices.
