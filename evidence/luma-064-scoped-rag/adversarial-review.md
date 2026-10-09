# LUMA-064 Adversarial findings — 2026-10-09

This document records **tests and implementer review**. It is **not** an independent IBM Granite reviewer approval or a deployed penetration test.

| Severity | Threat | Protection | Evidence |
| --- | --- | --- | --- |
| CRITICAL | One tenant's token retrieves another program's lesson | HMAC digest mapped to explicit tenant/program; 403 before embedding | Python HTTP tests + real Postgres `test_real_http_to_database_contract_returns_only_authorized_sources` |
| CRITICAL | API SQL accidentally omits `WHERE tenant_id` | `FORCE ROW LEVEL SECURITY` on sources and chunks, local transaction scope variables, read-only non-BYPASSRLS role | `test_pg_rls_prevents_unscoped_reads_and_write_role_bypass` |
| HIGH | Global approximate ANN ranking leaks top-K before scope filter | `WITH permitted AS MATERIALIZED ... WHERE tenant_id AND program_id` then exact cosine ranking | SQL inspection + 3-scope pgvector integration |
| HIGH | Expired or revoked token still retrieves during slow embedding | Permission checked before embedding and again inside retrieval transaction | `test_revoked_or_expired_token_is_denied_even_after_pre_authorization` |
| HIGH | Unapproved copyrighted/customer material is indexed as searchable | Staging remains draft; separate explicit approval with rights reference; revoked/deleted sources excluded | Draft/approval/deletion integration |
| HIGH | Deleted source reappears through retriggered staging | ID-only source deletion tombstone prevents re-ingest of same identity | Real Postgres deletion + re-ingest negative test |
| MEDIUM | Huge streaming payload overwhelms JSON parsing | 8 KiB request cap at ASGI boundary including chunked bodies | `test_chunked_oversized_stream_fails_closed_without_calling_embedding` |
| MEDIUM | Wrong embedding dimension or zero/NaN vector distorts similarity | Strict finite, nonzero, 768-D validation before pgvector cast | `test_invalid_embedding_never_enters_pgvector` |
| MEDIUM | Backend and LUMA frontend disagree on evidence fields | Synthetic Pydantic and Vitest end-to-end response contract | Python `test_contract.py` and `scoped-rag.backend-contract.test.ts` |

## Outstanding risks / unverified external factors

- **Production Cloud SQL/Cloud Run environment, least-privilege DB credentials, perimeter authentication, TLS, rate limits, Cloud Armor/API Gateway, scheduled rotation:** NOT YET VERIFIED.
- **Real Vertex AI embedding call and quota, latency under LUMA 4-second retrieval timeout, AI subprocessors/privacy commitments:** NOT YET VERIFIED. Only HTTP request formation and synthetic vector tests passed.
- **Seres de Excelencia source rights, transcript accuracy and cited video timecode accuracy:** NOT YET VERIFIED. All tested content is synthetic.
- **Distributed incident detection, load/soak, reliable backing up and deleting data from backups, customer retention and exit:** NOT YET VERIFIED.
- **IBM Granite / independent red-team human sign-off:** NOT YET VERIFIED; earlier local Ollama inference was unavailable due container memory limits. A separate CI runner validates code and SQL tests, but CI does not substitute for human security sign-off.
- **Service rollout:** NOT PERFORMED. Leave `LUMA_SCOPED_RAG_ISOLATION_ATTESTED` false/unset.
