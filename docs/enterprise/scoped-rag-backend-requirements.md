# Isolated RAG backend — implementable production contract

Status: TARGET REQUIREMENTS, **NOT deployed**. The existing single-corpus `pnl-video-rag` service is healthy but is not validated as multi-tenant. Do not point `LUMA_SCOPED_RAG_URL` to it or set `LUMA_SCOPED_RAG_ISOLATION_ATTESTED=true` merely because `/health` responds.

## Admission and service identity

Each server-only gateway credential must be bound to permitted `(tenant_id, program_id)` grants in the **backend**, not just in the client request body. Use strong randomly generated tokens stored only as salted/HMAC or hashed verifiers, rotated with least privilege. A request for a scope outside a credential's grants returns 403 without querying indexes. Deny requests with missing/invalid scope, stale grants or exhausted quota. Log a correlation ID and scope identity without persisting raw tokens or questions that contain PII.

## Isolation before retrieval

Every indexed content segment must carry immutable `tenant_id`, `program_id`, `source_id`, `chunk_id`, ingestion permission, release state, provenance and start/end video offsets. Embeddings/FTS cannot be queried without a tenant-program predicate. Avoid retrieving a global top-K and then filtering it; do not trust claimed tags in the response as evidence of database-level isolation.

A simple Postgres exact-ranking template (schema names to be reconciled with the actual service):

```sql
WITH permitted_chunks AS MATERIALIZED (
  SELECT chunk_id, source_id, title, text, start_seconds, end_seconds,
         embedding, tenant_id, program_id
  FROM indexed_segments
  WHERE tenant_id = $1 AND program_id = $2
    AND release_state = 'approved'
    AND deleted_at IS NULL
)
SELECT chunk_id, source_id, title, text, start_seconds, end_seconds,
       tenant_id, program_id
FROM permitted_chunks
ORDER BY embedding <=> $3
LIMIT LEAST($4, 8);
```

The backend must reject a query until the credential's allowed scope matches `$1` and `$2`; use parameter binding, strict index permissions and separate scoped deletion/reindex paths. This SQL is an **illustrative contract, not a migration applied to the current database**. Larger deployments may use per-tenant partitions/ANN indexes while preserving pre-top-K tenant-program filtering.

## Tests required before activation

Same search text over two tenants and two programs must never return foreign source IDs, titles, transcript text or video URLs. Test unauthorized scope with valid token, token replay/revocation, missing tags, cross-scope ingest, deletion-before-search, denied content, invalid timestamps, large responses, latency and pagination. Validate consent and licensing of source videos. Only once security review demonstrates these controls should operators provision `LUMA_SCOPED_RAG_URL`, `LUMA_SCOPED_RAG_TOKEN` and the attestation flag in Secret Manager.

## Current inspection (2026-10-09)

Legacy RAG health: HTTP 200; 1 valid source, 40 pending, 1 needing review, 69 chunks. A scope-shaped request without credentials returned HTTP 401. These demonstrate service availability and baseline authentication, **not** correct tenant filtering, approved corpus coverage or customer readiness. Backend source deployment tree was not mounted in this cloud sandbox; do not patch a missing source tree or reinterpret legacy results as scoped ones.
