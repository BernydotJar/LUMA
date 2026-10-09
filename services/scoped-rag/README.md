# LUMA-064 — Scoped RAG Backend

**Source implementation + PostgreSQL integration tests. Not yet deployed or authorized for a real client corpus.**

This standalone FastAPI service supplies the exact `/v1/search` request/response contract consumed by `src/lib/scoped-rag.ts`. It **does not replace** the existing legacy RAG endpoint. There is no global fallback in enterprise mode.

## Trust boundaries

1. LUMA resolves an effective Firebase + Commerce Enrollment scope server-side. It passes `{tenant_id,program_id}` and its server-only bearer credential.
2. The backend hashes the bearer with `HMAC-SHA256(LUMA_RAG_AUTH_PEPPER, token)` and verifies an unexpired, non-revoked **tenant/program-specific grant** in PostgreSQL **before** calling Vertex AI.
3. Vertex AI creates a 768-dimensional retrieval query embedding using `text-multilingual-embedding-002` (configurable, but query and ingestion **must use the same model**). ADC/workload identity supplies Google credentials; no JSON service-account key file required.
4. PostgreSQL sets transaction-local tenant/program variables. Forced row-level security restricts both `luma_rag.sources` and `luma_rag.chunks`; the HTTP role is read-only, not a superuser or table owner. A `MATERIALIZED` CTE selects **only approved chunks within the tenant/program** before exact pgvector cosine ranking. It does not globally rank vectors then remove foreign results.
5. The same grant is re-checked **after** the embedding call so a revoked token is rejected. Returned citations include source/video and exact timestamps; no synthesized answer is fabricated.
6. Source ingestion/approval/deletion are offline operator-only actions with a separate database role. No public admin or ingestion endpoints exist.

## Structure

| File | Purpose |
| --- | --- |
| `sql/001_scoped_rag.sql` | PostgreSQL 15+/pgvector migration, constraints, forced RLS and read-only role grants |
| `src/luma_scoped_rag/repository.py` | Scoped grants, transaction-local RLS, prefiltered vector ranking |
| `src/luma_scoped_rag/api.py` | Authenticated FastAPI endpoint, bounds and safe errors |
| `src/luma_scoped_rag/embeddings.py` | Google Vertex AI 768-D query/document embedding adapter |
| `src/luma_scoped_rag/admin.py` | Stage, approve, delete and revoke grants; audit tombstones |
| `src/luma_scoped_rag/cli.py` | Local operations; token written once into a private 0600 file |
| `contracts/search-response.example.json` | Synthetic LUMA TypeScript client contract fixture |
| `tests/` | Adversarial API tests and real PostgreSQL RLS, token, filtering and deletion tests |

## Development

Requires Python 3.11+, PostgreSQL 15+ with pgvector, and database admin access for migrations.

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[test]'
python -m ruff check src tests scripts
python -m pytest -q tests
```

The five PostgreSQL integration tests require `LUMA_RAG_TEST_ADMIN_DSN` and `LUMA_RAG_TEST_API_DSN`. They skip without the DSNs; the GitHub Actions `LUMA-064 Scoped RAG security` job provisions a **disposable pgvector PostgreSQL container** and supplies them. No customer content or credentials are used in test fixtures.

## Setup with actual infrastructure (operator-only, not performed)

Run migration as a DBA role:

```bash
psql "$LUMA_RAG_ADMIN_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/001_scoped_rag.sql
```

Create a **separate LOGIN** database role (not the schema owner, not superuser, not BYPASSRLS) and grant it `luma_rag_reader`. Its connection URL becomes `LUMA_RAG_DATABASE_URL`; keep the DBA URL only in offline operations. Require TLS and private IP/Cloud SQL connector or equivalent. Ensure project IAM provides Vertex AI prediction without API keys.

Set runtime secrets using Secret Manager or workload-specific secrets injection, never commit them:

- `LUMA_RAG_DATABASE_URL` (read-only database role)
- `LUMA_RAG_AUTH_PEPPER` (random 32+ byte secret, shared only with the separate offline admin CLI)
- `GOOGLE_CLOUD_PROJECT`, `VERTEX_LOCATION=us-central1`
- `LUMA_RAG_EMBEDDING_MODEL=text-multilingual-embedding-002`

Run with `uvicorn luma_scoped_rag.asgi:app --host 0.0.0.0 --port 8080`. `/healthz` reveals only process availability; `/readyz` checks the database role and forced RLS. The service **must be placed behind an HTTPS boundary with rate controls, body limits and observed p95 latency**. Deployment configuration and runtime grants are not yet present. Do not expose an unprotected Cloud Run HTTP service simply to make LUMA connect.

## Controlled content lifecycle

An authorized operator supplies a rights reference and curated educational segments (from transcription+human review). They are embedded using `RETRIEVAL_DOCUMENT`, staged in `draft`, then explicitly approved:

```bash
python -m luma_scoped_rag.cli stage-source \
  --tenant "tenant-id" --program "program-id" --source-file /secure/reviewed-source.json
python -m luma_scoped_rag.cli approve-source \
  --tenant "tenant-id" --program "program-id" --source-id "source-id" --reviewer "review-id"
python -m luma_scoped_rag.cli delete-source \
  --tenant "tenant-id" --program "program-id" --source-id "source-id" --reason-code CLIENT_ERASURE
```

The admin script requires `LUMA_RAG_ADMIN_DATABASE_URL` and appropriate Google ADC credentials. It never automatically migrates the 40 legacy pending sources or marks content approved. Deletion removes live chunks/embeddings and writes an ID-only tombstone; **backup retention and legal hold may keep historical copies**, so an enterprise erasure agreement and backup expiry workflow remain required.

Generate an independent bearer grant without printing it in CLI logs:

```bash
python -m luma_scoped_rag.cli provision-key \
  --tenant "tenant-id" --program "program-id" --expires-days 30 \
  --token-output /secure/private-scoped-token
```

The token file is created with mode `0600`; copy it through approved secret delivery to LUMA's `LUMA_SCOPED_RAG_TOKEN`. The server validates the credential's database scope, not merely the claimed JSON scope. After a validated backend deployment, configure LUMA's `LUMA_SCOPED_RAG_URL` and **only then**, following independent backend red-team and source-permission checks, enable `LUMA_SCOPED_RAG_ISOLATION_ATTESTED=true`. Keep `LUMA_LEARNING_ACCESS_MODE=entitled` and permitted program configuration separate and verified.

## Limitations and pilot blockers

- No actual production database, credentials, approved SE corpus, live Vertex call or signed client token provisioning was performed. CI tests use fake 768-D embeddings; Vertex's HTTP request shape is unit-tested but external availability/billing is not measured.
- Semantic quality, source citation relevance, video timestamp precision, content deletion effectiveness across backups, ingress throttling, Cloud Run IAM/API Gateway and p95 under peak concurrency remain **NOT YET VERIFIED**.
- Do not claim contractual uptime, retention, RTO/RPO, unlimited concurrency or proven economic savings from these tests.
- Enterprise activation and the Product's independent security reviewer remain separate release gates. Use `docs/enterprise/luma-064-scoped-rag.md` as the decision record.
