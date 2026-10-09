# LUMA-065 — Synthetic Staging & Enterprise RAG Security Gate

**Date:** October 9, 2026
**Branch:** `feat/luma-065-staging-security`
**Status:** LOCAL STAGING VERIFIED · GCP BACKEND NOT DEPLOYED · ENTERPRISE PILOT BLOCKED

## Current implementation and architecture

LUMA-064's isolated RAG backend has been merged into `main` (PR #21, merge `278e2ff`). LUMA-065 validates the service through a real, localhost-bound Uvicorn/FastAPI server against PostgreSQL 15 + pgvector. The staging database is **disposable and contains synthetic test data only**. A deterministic embedding adapter is injected explicitly into this test runner; the production `luma_scoped_rag.asgi` module still creates the real Google Vertex AI adapter and requires ADC.

The smoke test exercises three distinct tenant/program scopes using separate token grants and HTTPS-only synthetic source metadata. It checks HTTP readiness, valid access, wrong-program and cross-tenant denial, absent/invalid tokens, request size limit, revocation, and data deletion with anti-reingestion. All requests are made from the workstation to `127.0.0.1`. The server is stopped and test records are deleted after the run. There is no published staging URL or production configuration change.

The independent scoped-RAG GitHub workflow additionally runs this synthetic HTTP test against a disposable pgvector database. Its Docker container uses a bridge-network server address, so the staging guard explicitly accepts it only for `CI=true`, a `_test` database and a localhost-connected client; direct remote databases remain rejected by test. It does not substitute for cloud perimeter, IAM or external red-team verification.

## Real GCP inventory (read-only, verified)

| Item | Observed result | Classification |
| --- | --- | --- |
| Cloud Run services, `us-central1` | `luma`, `se-voice-runtime` | VERIFIED via Google Cloud Run API |
| Cloud SQL instances, `luma-learning-intelligence` | **0** | VERIFIED via Cloud SQL Admin API |
| Vertex AI API `aiplatform.googleapis.com` | **DISABLED** | VERIFIED via Service Usage API |
| Live Vertex query embedding | **HTTP 403, SERVICE_DISABLED** | VERIFIED attempted; successful inference NOT YET VERIFIED |
| Local isolated PostgreSQL/pgvector | PostgreSQL 15 running on Unix socket, no TCP listener, staging DB `luma065_stage` | VERIFIED |
| Dedicated hosted scoped RAG endpoint | None created | NOT DEPLOYED |
| `LUMA_SCOPED_RAG_ISOLATION_ATTESTED` in production | Not enabled by this change | Not an activation |

The GCP credentials permitted read-only service/resource inspection. **No Google API was enabled, Cloud SQL instance purchased, IAM changed, Cloud Run service created or Firebase deployment triggered.** Vertex AI cannot be assessed end-to-end until a separately approved staging project/environment enables the API and grants only the necessary prediction role to its workload identity.

## Security finding resolved in LUMA-065

**HIGH — Over-privileged database startup could self-grant any tenant.** `PgScopedRepository.verify_reader_role()` previously rejected write privileges to `luma_rag.chunks`, but did not detect `UPDATE` on `luma_rag.access_grants`, or writes to sources/deletion receipts. An API role mistakenly granted `UPDATE` on grants could create its own tenant authorization. The startup gate now rejects all INSERT, UPDATE, DELETE and TRUNCATE rights across the four protected tables, and any CREATE privilege on `luma_rag` schema. A PostgreSQL test creates a deliberately overprivileged role and proves the gateway rejects it.

This is a **runtime fail-closed check**, not a replacement for least-privilege database provisioning and independent IAM audit.

## Verification matrix

| Control | Result |
| --- | --- |
| Python lint | VERIFIED — PASS local |
| Python API / RLS / pgvector / role security tests | VERIFIED — 23/23 PASS local |
| Localhost-only full HTTP staging smoke | VERIFIED — 11 checks PASS local |
| Data cleanup after staging | VERIFIED — 0 sources, chunks, grants and deletion receipts |
| Graph Harness event integrity | Verify during release candidate |
| GitHub Actions Python/pgvector/staging | PENDING this branch's CI |
| Full LUMA TypeScript/Playwright | PENDING this branch's CI |
| Real Vertex prediction, quota, latency | BLOCKED — API disabled |
| Cloud-hosted staging backed by private Cloud SQL | NOT PERFORMED — no Cloud SQL instance |
| Human/Granite independent security review | NOT YET VERIFIED |
| Client licensed corpus, operational incident/backup/load gates | NOT YET VERIFIED |

## Proposed hosted staging, subject to budget and security approval

1. Provision or allocate a **separate staging project**, identity and budget alert. Validate projected Cloud SQL/PostgreSQL, Vertex AI, Cloud Run, networking and logging costs before creating billable resources.
2. Enable Vertex AI API **in staging**, not in the existing production LUMA project. Confirm that the intended multilingual embedding model is available in `us-central1`; cap quota and requests.
3. Configure Cloud SQL Postgres with pgvector, private network connectivity, a **read-only, non-owner reader role**, and a separate admin/ingest role. Apply `services/scoped-rag/sql/001_scoped_rag.sql` with migration privileges only.
4. Deploy the immutable service container to Cloud Run staging behind authenticated ingress and request/rate controls. Supply `LUMA_RAG_DATABASE_URL`, `LUMA_RAG_AUTH_PEPPER` via Secret Manager with least privilege. Use workload identity for Vertex.
5. Create two synthetic tenant identities and distinct program grants; stage one synthetic source per scope and independently verify denied cross-tenant requests over HTTPS.
6. Test revoked tokens, deletion, missing dependencies, timeouts and 429/503 behavior. Collect structured correlation IDs, no raw questions or secrets in logs.
7. Only after security/privacy approval and actual educational content rights review, enable scoped-RAG test access from a dedicated LUMA staging frontend. Leave `LUMA_SCOPED_RAG_ISOLATION_ATTESTED` unset in production until signed independent verification.

**Do not deploy the fake synthetic embedder to Cloud Run.** The test harness injects it only during isolated smoke tests. The production ASGI module fails at startup if real model credentials or database authority are missing.

## Local verification commands (no production access)

```bash
cd services/scoped-rag
python -m ruff check src tests scripts
PYTHONPATH="$PWD/src" \
LUMA_RAG_TEST_ADMIN_DSN="$LOCAL_TEST_ADMIN_DSN" \
LUMA_RAG_TEST_API_DSN="$LOCAL_TEST_API_DSN" \
python -m pytest -q tests

# Explicit localhost only. Both DSNs must target the same isolated _stage DB.
PYTHONPATH="$PWD/src" \
LUMA_RAG_STAGING_ADMIN_DSN="$LOCAL_STAGE_ADMIN_DSN" \
LUMA_RAG_STAGING_API_DSN="$LOCAL_STAGE_API_DSN" \
python scripts/staging_http_smoke.py
```

The service itself remains staged **in source and local test infrastructure**, not deployed to GCP. A green CI is a prerequisite to, not a substitute for, the remaining operational release gates.

## E2E release-gate finding

The combined product CI caught a real mobile learner navigation regression: the newly added Certificates entry displaced the LUMA tutor link from the four-item mobile bottom bar. The fix renders five first-class learner destinations with five grid columns and verifies link visibility, minimum tap width, absence of horizontal overflow and access to the certificates route in Playwright. No coach/studio navigation behavior was changed. Independent CI rerun is required; the initial failure remains recorded in `evidence/luma-065-staging-security/ci-repair.md`.
