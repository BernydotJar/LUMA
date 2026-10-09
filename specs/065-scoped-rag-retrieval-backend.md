# LUMA-064 — Scoped Knowledge Retrieval (PostgreSQL + pgvector)

Status: producer implementation complete; GitHub CI and independent adversarial verification pending; enterprise production activation blocked.

## Requirements

- Authorized tenant and program must be enforced by service credentials in the storage layer, not by client scope tags alone.
- Request must be denied before embedding for an unknown key or unauthorized scope.
- Query/document embeddings must use a single configurable 768-D multilingual model.
- Restrict retrieval to approved, non-deleted sources and an exact tenant-program match **before** nearest-neighbor ranking.
- Required response: source ID, chunk ID, program, HTTPS source URL, supporting text and timestamps; no unsupported or fabricated answer.
- Staging/approval/deletion flow separate from reader API; deleted chunks and vectors not retrievable.
- Failure of DB/embedding/gateway must fail closed; no fallback to legacy shared corpus.
- No client-special-case logic, no migration of legacy pending corpus without consent, and no production release without evidence.

## Producer

`services/scoped-rag`: FastAPI, Google Vertex AI multilingual embedding adapter, PostgreSQL 15+ / pgvector, forced row-level security, HMAC scope grants, offline curator CLI, schema migration and adversarial tests.

## Critic / failure cases

- Wrong token / scope ⇒ 401/403 before calling Vertex.
- Valid token, wrong program or tenant ⇒ 403 and zero foreign rows.
- Direct SQL read under the app role without scope ⇒ zero rows.
- Draft/revoked/deleted source ⇒ never retrieved.
- Token revoked while embedding ⇒ second scope grant check denies retrieval.
- Large JSON body, including chunked requests ⇒ HTTP 413 without embedding.
- Unsafe URL, zero or malformed vector, invalid timestamps ⇒ reject.
- Reindex already approved source ⇒ reject until explicit curator deletion/restaging.

## Verification

Unit and local PostgreSQL/pgvector tests; an independent GitHub Actions job must run fresh isolated DB setup, migration, RLS checks, 3-scope attack tests, TypeScript backend contract, full Next CI and dependency audit. Log pass/fail, actual CI SHA and any limitations in evidence.

## Release gate

No automatic deployment. An independent verifier of backend isolation, authorized real client corpus, network/secret/IAM setup, load, recovery and data governance must approve the enterprise pilot; `LUMA_SCOPED_RAG_ISOLATION_ATTESTED` remains unset until then.
