"""Provision only a disposable test role inside the CI pgvector database."""
from __future__ import annotations

import os
from pathlib import Path

import psycopg

ADMIN_DSN = os.environ["LUMA_RAG_TEST_ADMIN_DSN"]
MIGRATION = Path(__file__).resolve().parents[1] / "sql/001_scoped_rag.sql"

with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
    conn.execute(MIGRATION.read_text())
    conn.execute(
        """DO $$ BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'luma064_api_test') THEN
               CREATE ROLE luma064_api_test LOGIN NOSUPERUSER NOBYPASSRLS
                 PASSWORD 'local-test-only-api-password';
             END IF;
           END $$"""
    )
    conn.execute("GRANT luma_rag_reader TO luma064_api_test")
    actual = conn.execute("SELECT extversion FROM pg_extension WHERE extname='vector'").fetchone()
    if not actual:
        raise RuntimeError("pgvector extension not installed")
    print("Scoped pgvector migration, forced RLS and read-only test role ready")
