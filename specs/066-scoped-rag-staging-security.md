# LUMA-065 — Scoped RAG Staging, Security Critic & Release Evidence

Status: producer implemented in branch; CI verification and independent security approval pending.

## Producer

Introduce a reproducible localhost-only staging smoke test with synthetic training material in a disposable PostgreSQL/pgvector database and a real Uvicorn/FastAPI transport. Never substitute fake embeddings into the production application entry point. Apply a minimal database reader permission hardening patch. Record GCP staging prerequisites and resource costs as unknown until approved.

## Critic

Threats: tenant/program IDOR, forged bearer tokens, direct SQL bypass of tenant filters, excessive API role grants allowing grant mutation, oversized HTTP payload, refunded/revoked authorization, source deletion undone by reindex, fake embedding leakage into production and unintended cloud resource spend.

## Fixer

- Check effective DB read-only permissions over all protected tables and schema on service readiness, not only chunks.
- Test with an intentional overprivileged role attempting to mutate access grants.
- Stage three independent tenant/program scopes; run HTTP 200/401/403/413 probes against localhost only.
- Revoke keys and erase a source; assert no surviving indexed record and reject re-ingest.
- Record actual GCP Cloud Run/Cloud SQL/Vertex API availability and leave external resources unchanged.

## Independent Verifier / Release Gate

Require independent GitHub Actions Python + real PostgreSQL/pgvector and staging HTTP smoke; complete LUMA Next.js, Firestore and Playwright jobs; Graph Harness validate + checkpoint. Maintain pilot BLOCKED pending independent security review, Cloud SQL, Vertex, secrets, approved real content, retention, cost, capacity and on-call/incident controls.

## Product CI regression discovered by verifier

Full LUMA Playwright surfaced a deterministic mobile navigation issue introduced when the Certificates destination was added before LUMA but the bottom navigation remained limited to four items. Producer/critic fixes retain all five learner destinations in the mobile navigation and add a mobile route/geometry regression test. Independent browser CI must pass before considering this source PR review-ready.
