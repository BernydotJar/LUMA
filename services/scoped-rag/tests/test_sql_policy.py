from pathlib import Path

from luma_scoped_rag.repository import SCOPED_SEARCH_SQL, key_digest


def test_materialized_scope_filter_is_inside_candidate_cte():
    sql = " ".join(SCOPED_SEARCH_SQL.lower().split())
    assert "with permitted as materialized" in sql
    assert sql.index("where c.tenant_id = %s") < sql.index("embedding <=>")
    assert sql.index("s.release_state = 'approved'") < sql.index("embedding <=>")
    assert "s.deleted_at is null" in sql
    assert "limit %s" in sql
    assert "::vector(768)" in sql


def test_database_enforces_rls_and_read_only_app_role():
    root = Path(__file__).parents[1]
    sql = (root / "sql/001_scoped_rag.sql").read_text().lower()
    assert "force row level security" in sql
    assert "to luma_rag_reader" in sql
    assert "current_setting('luma.rag.tenant_id', true)" in sql
    assert "current_setting('luma.rag.program_id', true)" in sql
    assert "grant select on luma_rag.sources, luma_rag.chunks" in sql
    assert "on delete cascade" in sql
    assert "create index if not exists rag_chunks_scope_idx" in sql


def test_token_digest_requires_valid_secret_and_is_not_raw_key():
    token = "lrag_" + "A" * 47
    pepper = "p" * 40
    digest = key_digest(token, pepper)
    assert len(digest) == 64
    assert token not in digest
    assert digest != key_digest(token, "q" * 40)
