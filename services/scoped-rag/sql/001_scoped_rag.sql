-- LUMA-064, PostgreSQL >= 15 + pgvector. Run as a migration/DBA role.
-- NEVER run the HTTP service with the migration role or a SUPERUSER/BYPASSRLS role.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS luma_rag;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luma_rag_reader') THEN
    CREATE ROLE luma_rag_reader NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS luma_rag.access_grants (
  token_digest text NOT NULL CHECK (token_digest ~ '^[a-f0-9]{64}$'),
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  program_id text NOT NULL CHECK (length(program_id) BETWEEN 1 AND 128),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_digest, tenant_id, program_id)
);
CREATE INDEX IF NOT EXISTS rag_grants_expiry ON luma_rag.access_grants(expires_at);

CREATE TABLE IF NOT EXISTS luma_rag.sources (
  tenant_id text NOT NULL CHECK (length(tenant_id) BETWEEN 1 AND 128),
  program_id text NOT NULL CHECK (length(program_id) BETWEEN 1 AND 128),
  source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 256),
  drive_file_id text NOT NULL DEFAULT '',
  module text NOT NULL DEFAULT '',
  title text NOT NULL,
  drive_url text NOT NULL,
  embedding_model text NOT NULL,
  license_reference text NOT NULL CHECK (length(license_reference) BETWEEN 1 AND 256),
  approved_by text,
  approved_at timestamptz,
  release_state text NOT NULL DEFAULT 'draft'
    CHECK (release_state IN ('draft', 'approved', 'revoked')),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, program_id, source_id)
);

CREATE TABLE IF NOT EXISTS luma_rag.chunks (
  tenant_id text NOT NULL,
  program_id text NOT NULL,
  source_id text NOT NULL,
  chunk_id text NOT NULL CHECK (length(chunk_id) BETWEEN 1 AND 256),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 4096),
  start_seconds integer NOT NULL CHECK (start_seconds >= 0),
  end_seconds integer NOT NULL CHECK (end_seconds > start_seconds AND end_seconds <= 86399),
  embedding vector(768) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, program_id, source_id, chunk_id),
  FOREIGN KEY (tenant_id, program_id, source_id)
    REFERENCES luma_rag.sources(tenant_id, program_id, source_id)
    ON DELETE CASCADE
);
-- Exact, tenant/program prefiltered similarity ranking. No global ANN index is
-- provisioned. Optimise later ONLY after a tenant-aware recall/security review.
CREATE INDEX IF NOT EXISTS rag_chunks_scope_idx
  ON luma_rag.chunks(tenant_id, program_id, source_id);
CREATE INDEX IF NOT EXISTS rag_sources_approved_idx
  ON luma_rag.sources(tenant_id, program_id, embedding_model, release_state)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS luma_rag.source_deletions (
  tenant_id text NOT NULL,
  program_id text NOT NULL,
  source_id text NOT NULL,
  reason_code text NOT NULL,
  removed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, program_id, source_id)
);

-- The API DB role is SELECT only. The application sets tenant/program GUCs
-- locally inside EACH transaction. FORCE RLS protects even table owners.
ALTER TABLE luma_rag.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_rag.sources FORCE ROW LEVEL SECURITY;
ALTER TABLE luma_rag.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE luma_rag.chunks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rag_sources_read_scope ON luma_rag.sources;
CREATE POLICY rag_sources_read_scope ON luma_rag.sources
  FOR SELECT TO luma_rag_reader
  USING (tenant_id = current_setting('luma.rag.tenant_id', true)
     AND program_id = current_setting('luma.rag.program_id', true));
DROP POLICY IF EXISTS rag_chunks_read_scope ON luma_rag.chunks;
CREATE POLICY rag_chunks_read_scope ON luma_rag.chunks
  FOR SELECT TO luma_rag_reader
  USING (tenant_id = current_setting('luma.rag.tenant_id', true)
     AND program_id = current_setting('luma.rag.program_id', true));

GRANT USAGE ON SCHEMA luma_rag TO luma_rag_reader;
GRANT SELECT ON luma_rag.access_grants TO luma_rag_reader;
GRANT SELECT ON luma_rag.sources, luma_rag.chunks TO luma_rag_reader;
REVOKE ALL ON luma_rag.source_deletions FROM PUBLIC, luma_rag_reader;
COMMIT;
