from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from luma_scoped_rag.api import create_app
from luma_scoped_rag.models import EvidenceHit, Scope
from luma_scoped_rag.repository import Forbidden, Unauthorized

KEY = "lrag_" + "K" * 45
HEADERS = {"Authorization": f"Bearer {KEY}"}
SCOPE = {"tenant_id": "tenant-a", "program_id": "program-1"}
QUERY = {"query": "How do we practice feedback?", "limit": 3, "scope": SCOPE}


class FakeRepository:
    def __init__(self) -> None:
        self.authorized: list[Scope] = []
        self.searched: list[Scope] = []
        self.fail_after_embedding = False
        self.ready = True

    def authorize(self, token: str, scope: Scope) -> None:
        if token != KEY:
            raise Unauthorized()
        if scope != Scope(**SCOPE):
            raise Forbidden()
        self.authorized.append(scope)

    def search(self, token: str, scope: Scope, vector: list[float], limit: int):
        self.searched.append(scope)
        if self.fail_after_embedding:
            raise Forbidden()
        assert vector[0] == 1.0 and len(vector) == 768
        return [
            EvidenceHit(
                tenant_id=scope.tenant_id, program_id=scope.program_id,
                source_id="source-1", chunk_id="chunk-1", drive_file_id="file-a",
                module="Coach", title="Practice recording", text="Practice the skill",
                start_seconds=15, end_seconds=30,
                start_clock="00:00:15", end_clock="00:00:30",
                drive_url="https://example.org/course/1",
            )
        ][:limit]

    def verify_reader_role(self) -> None:
        if not self.ready:
            raise RuntimeError("bad role")


class FakeEmbedder:
    def __init__(self) -> None:
        self.calls: list[str] = []

    def embed_query(self, text: str) -> list[float]:
        self.calls.append(text)
        return [1.0] + [0.0] * 767


@pytest.fixture
def deps():
    repo, embedder = FakeRepository(), FakeEmbedder()
    return TestClient(create_app(repo, embedder)), repo, embedder


def test_scope_is_required_and_authorized_before_embedding(deps):
    client, repository, embedder = deps
    for headers, body, status in [
        ({}, QUERY, 401),
        ({"Authorization": "Bearer wrong-key"}, QUERY, 401),
        (HEADERS, {**QUERY, "scope": {"tenant_id": "tenant-b", "program_id": "program-1"}}, 403),
        (HEADERS, {**QUERY, "scope": {"tenant_id": "tenant-a", "program_id": "program-2"}}, 403),
        (HEADERS, {"query": QUERY["query"], "limit": 2}, 422),
    ]:
        result = client.post("/v1/search", json=body, headers=headers)
        assert result.status_code == status
    assert embedder.calls == []
    assert repository.searched == []


def test_authorized_answer_has_only_scope_and_citable_video_provenance(deps):
    client, repository, embedder = deps
    result = client.post("/v1/search", json=QUERY, headers=HEADERS)
    assert result.status_code == 200
    data = result.json()
    assert data["scope"] == SCOPE
    assert data["retrieval"] == "scoped_pgvector_exact"
    assert len(data["results"]) == 1
    assert data["results"][0]["start_clock"] == "00:00:15"
    assert data["results"][0]["program_id"] == "program-1"
    assert result.headers["Cache-Control"] == "no-store"
    assert "X-Correlation-ID" in result.headers
    assert embedder.calls == [QUERY["query"]]
    assert repository.searched == [Scope(**SCOPE)]


def test_revoked_between_authorization_and_search_is_denied(deps):
    client, repository, embedder = deps
    repository.fail_after_embedding = True
    response = client.post("/v1/search", json=QUERY, headers=HEADERS)
    assert response.status_code == 403
    assert embedder.calls == [QUERY["query"]]


def test_rejects_unknown_fields_and_invalid_scope(deps):
    client, repo, embedder = deps
    for body in [
        {**QUERY, "internal": "admin"},
        {**QUERY, "scope": {**SCOPE, "admin": True}},
        {**QUERY, "scope": {"tenant_id": "tenant/a", "program_id": "program-1"}},
        {**QUERY, "query": "X" * 2049},
        {**QUERY, "limit": 9},
    ]:
        assert client.post("/v1/search", json=body, headers=HEADERS).status_code == 422
    assert not repo.authorized
    assert not embedder.calls


def test_health_and_readiness_do_not_expose_corpus_details(deps):
    client, repo, _ = deps
    assert client.get("/healthz").json() == {"status": "up"}
    assert client.get("/readyz").json() == {"status": "ready"}
    repo.ready = False
    assert client.get("/readyz").status_code == 503


def test_large_json_is_rejected_without_using_embedding(deps):
    client, _, embedder = deps
    result = client.post(
        "/v1/search", data="x" * 9000,
        headers={**HEADERS, "Content-Type": "application/json"},
    )
    assert result.status_code == 413
    assert embedder.calls == []


def test_chunked_oversized_stream_fails_closed_without_calling_embedding(deps):
    client, _, embedder = deps
    def chunks():
        yield b"{" + b"x" * 4096
        yield b"y" * 4097

    result = client.post(
        "/v1/search", content=chunks(),
        headers={**HEADERS, "Content-Type": "application/json", "Transfer-Encoding": "chunked"},
    )
    assert result.status_code == 413
    assert embedder.calls == []
