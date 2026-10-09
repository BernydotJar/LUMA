# LUMA-065 — Concrete security critique and fix

**Finding:** A search service database role holding UPDATE on `luma_rag.access_grants` could authorize itself for another tenant. The earlier startup check only examined mutation permissions on the `luma_rag.chunks` table. This is high impact in a system where grants protect proprietary client content.

**Minimal remediation:** Extend `verify_reader_role()` to enforce no INSERT, UPDATE, DELETE or TRUNCATE privilege across `access_grants`, `sources`, `chunks`, `source_deletions`, nor CREATE on the protected schema. Fail startup if privileges exceed read-only. The configuration must still provision a non-superuser, non-BYPASSRLS role, with forced RLS on sources and chunks.

**Adversarial proof:** `test_reader_readiness_denies_grant_mutation_even_when_chunk_permissions_are_readonly` creates a synthetic role with UPDATE on access_grants; the previous code did not reject it (test failed), and the patched code rejects it (test passes). With `PYTHONPATH` set to the new branch, the 9-stateful-test subset and the full 23-test suite pass. The initial failed test also exposed a local editable-install mismatch to an older worktree, corrected by explicitly targeting the active branch's source path.

**Environment evaluation:** The GCP project contains 0 Cloud SQL instances and has `aiplatform.googleapis.com` disabled. This is a concrete deployment blocker, not a code exploit. The staging smoke uses only local synthetic content and does not modify production.

**Outstanding:** Independent human or separate IBM Granite security approval, public ingress/identity, real corpus rights, Vertex quota/cost, tenant data lifecycle across backups, load/soak and operational recovery remain unverified. Do not mark the enterprise gate approved.
