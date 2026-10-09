from __future__ import annotations

import os
import uuid
from datetime import UTC, datetime, timedelta

import psycopg
import pytest
from fastapi.testclient import TestClient

from luma_scoped_rag.admin import (
    SourceIngest,
    approve_source,
    delete_source,
    provision_token,
    revoke_token,
    stage_source,
)
from luma_scoped_rag.api import create_app
from luma_scoped_rag.models import Scope
from luma_scoped_rag.repository import Forbidden, PgScopedRepository, Unauthorized

ADMIN_DSN = os.environ.get("LUMA_RAG_TEST_ADMIN_DSN")
API_DSN = os.environ.get("LUMA_RAG_TEST_API_DSN")
pytestmark = pytest.mark.skipif(
    not ADMIN_DSN or not API_DSN,
    reason=(
        "Postgres/pgvector integration requires "
        "LUMA_RAG_TEST_ADMIN_DSN and LUMA_RAG_TEST_API_DSN"
    ),
)

PEPPER = "local-test-only-secret-pepper-abcdefgh123456"
MODEL = "text-multilingual-embedding-002"
VECTOR = [1.0] + [0.0] * 767


class LocalEmbedder:
    def embed_document(self, text: str):
        # Deterministic synthetic embeddings are TEST-ONLY, never production.
        return VECTOR


@pytest.fixture
def database():
    if not ADMIN_DSN or not API_DSN:
        pytest.skip("Postgres not configured")
    suffix = uuid.uuid4().hex[:14]
    scope_a = Scope(tenant_id=f"tenant-a-{suffix}", program_id="program-one")
    scope_a_other = Scope(tenant_id=f"tenant-a-{suffix}", program_id="program-two")
    scope_b = Scope(tenant_id=f"tenant-b-{suffix}", program_id="program-one")
    conn = psycopg.connect(ADMIN_DSN, autocommit=True)
    repo = PgScopedRepository(API_DSN, PEPPER, MODEL)
    repo.verify_reader_role()
    yield conn, repo, [scope_a, scope_a_other, scope_b]
    with conn.transaction():
        conn.execute("DELETE FROM luma_rag.sources WHERE tenant_id IN (%s,%s)",
                     (scope_a.tenant_id, scope_b.tenant_id))
        conn.execute("DELETE FROM luma_rag.access_grants WHERE tenant_id IN (%s,%s)",
                     (scope_a.tenant_id, scope_b.tenant_id))
        conn.execute("DELETE FROM luma_rag.source_deletions WHERE tenant_id IN (%s,%s)",
                     (scope_a.tenant_id, scope_b.tenant_id))
    conn.close()


def source(scope: Scope, label: str, source_id: str = "source-1") -> SourceIngest:
    return SourceIngest.model_validate({
        "scope": scope.model_dump(), "source_id": source_id, "drive_file_id": f"drive-{label}",
        "module": "Practice", "title": f"Authorized lesson {label}",
        "drive_url": f"https://example.org/class/{label}",
        "license_reference": f"consent-{label}",
        "segments": [
            {"chunk_id": "chunk-one", "text": f"Synthetic material {label}",
             "start_seconds": 5, "end_seconds": 25},
        ],
    })


def grant(conn, scope):
    return provision_token(
        conn, PEPPER, scope, datetime.now(UTC) + timedelta(days=1),
    )


def test_real_pgvector_scopes_before_similarity_ranking(database):
    conn, repo, (a1, a2, b1) = database
    for scope, label in ((a1, "A1"), (a2, "A2"), (b1, "B1")):
        assert stage_source(conn, source(scope, label), LocalEmbedder(), MODEL) == 1
        approve_source(conn, scope, "source-1", "independent-training-reviewer")
    token = grant(conn, a1)
    repo.authorize(token, a1)
    result = repo.search(token, a1, VECTOR, 8)
    assert [item.text for item in result] == ["Synthetic material A1"]
    assert [(item.tenant_id, item.program_id) for item in result] == [
        (a1.tenant_id, a1.program_id),
    ]
    with pytest.raises(Forbidden):
        repo.authorize(token, a2)
    with pytest.raises(Forbidden):
        repo.search(token, b1, VECTOR, 8)
    assert repo.search(token, a1, VECTOR, 1)[0].start_clock == "00:00:05"


def test_pg_rls_prevents_unscoped_reads_and_write_role_bypass(database):
    conn, repo, (a1, a2, b1) = database
    for scope, label in ((a1, "A1"), (b1, "B1")):
        stage_source(conn, source(scope, label), LocalEmbedder(), MODEL)
        approve_source(conn, scope, "source-1", "reviewer")
    with repo.connect() as api_conn:
        # Even a direct SELECT bypassing our WHERE clause sees no unscoped rows.
        count = api_conn.execute("SELECT COUNT(*) AS n FROM luma_rag.chunks").fetchone()["n"]
        assert count == 0
        with api_conn.transaction():
            repo._set_scope(api_conn, a1)
            found = api_conn.execute("SELECT content FROM luma_rag.chunks").fetchall()
            assert [row["content"] for row in found] == ["Synthetic material A1"]
            other = api_conn.execute(
                "SELECT count(*) AS n FROM luma_rag.chunks WHERE tenant_id = %s",
                (b1.tenant_id,),
            ).fetchone()
            assert other["n"] == 0
        assert api_conn.execute(
            "SELECT COUNT(*) AS n FROM luma_rag.chunks"
        ).fetchone()["n"] == 0
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            api_conn.execute(
                "DELETE FROM luma_rag.chunks WHERE tenant_id = %s", (a1.tenant_id,)
            )


def test_draft_not_retrievable_and_deletion_purges_embeddings(database):
    conn, repo, (a1, _, _) = database
    token = grant(conn, a1)
    stage_source(conn, source(a1, "draft"), LocalEmbedder(), MODEL)
    assert repo.search(token, a1, VECTOR, 8) == []
    approve_source(conn, a1, "source-1", "consent-owner")
    assert len(repo.search(token, a1, VECTOR, 8)) == 1
    delete_source(conn, a1, "source-1", "CLIENT_DATA_ERASURE")
    assert repo.search(token, a1, VECTOR, 8) == []
    tombstone = conn.execute(
        "SELECT reason_code FROM luma_rag.source_deletions"
        " WHERE tenant_id=%s AND program_id=%s AND source_id=%s",
        (a1.tenant_id, a1.program_id, "source-1"),
    ).fetchone()
    assert tombstone[0] == "CLIENT_DATA_ERASURE"
    assert conn.execute(
        "SELECT count(*) FROM luma_rag.chunks WHERE tenant_id=%s AND program_id=%s",
        (a1.tenant_id, a1.program_id),
    ).fetchone()[0] == 0
    with pytest.raises(ValueError, match="cannot be reingested"):
        stage_source(conn, source(a1, "replay-erase"), LocalEmbedder(), MODEL)


def test_revoked_or_expired_token_is_denied_even_after_pre_authorization(database):
    conn, repo, (a1, _, _) = database
    token = grant(conn, a1)
    stage_source(conn, source(a1, "A1"), LocalEmbedder(), MODEL)
    approve_source(conn, a1, "source-1", "reviewer")
    repo.authorize(token, a1)
    assert revoke_token(conn, PEPPER, token) == 1
    with pytest.raises(Unauthorized):
        repo.search(token, a1, VECTOR, 8)
    assert revoke_token(conn, PEPPER, token) == 0


def test_approved_source_cannot_be_silently_replaced_with_other_content(database):
    conn, repo, (a1, _, _) = database
    stage_source(conn, source(a1, "A1"), LocalEmbedder(), MODEL)
    approve_source(conn, a1, "source-1", "reviewer")
    with pytest.raises(ValueError, match="silently reindexed"):
        stage_source(conn, source(a1, "malicious"), LocalEmbedder(), MODEL)
    token = grant(conn, a1)
    assert repo.search(token, a1, VECTOR, 8)[0].text == "Synthetic material A1"


def test_real_http_to_database_contract_returns_only_authorized_sources(database):
    conn, repo, (a1, a2, b1) = database
    for scoped, label in ((a1, "A1"), (a2, "A2"), (b1, "B1")):
        stage_source(conn, source(scoped, label), LocalEmbedder(), MODEL)
        approve_source(conn, scoped, "source-1", "reviewer")
    token = grant(conn, a1)

    class QueryEmbedder:
        def __init__(self):
            self.calls = 0

        def embed_query(self, text: str):
            self.calls += 1
            return VECTOR

    embedder = QueryEmbedder()
    client = TestClient(create_app(repo, embedder))
    payload = {"query": "practice", "limit": 5, "scope": a1.model_dump()}
    headers = {"Authorization": f"Bearer {token}"}
    good = client.post("/v1/search", json=payload, headers=headers)
    assert good.status_code == 200
    assert good.json()["scope"] == a1.model_dump()
    assert len(good.json()["results"]) == 1
    result = good.json()["results"][0]
    assert result["text"] == "Synthetic material A1"
    assert result["source_id"] == "source-1"
    assert result["start_clock"] == "00:00:05"
    assert result["drive_url"] == "https://example.org/class/A1"
    assert all("B1" not in str(x) and "A2" not in str(x) for x in good.json()["results"])
    assert embedder.calls == 1
    bad = client.post("/v1/search", json={**payload, "scope": b1.model_dump()}, headers=headers)
    assert bad.status_code == 403
    assert embedder.calls == 1
    no_key = client.post("/v1/search", json=payload)
    assert no_key.status_code == 401
    assert embedder.calls == 1
