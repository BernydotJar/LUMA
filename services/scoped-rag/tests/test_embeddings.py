from __future__ import annotations

import httpx
import pytest
from google.auth.credentials import Credentials

from luma_scoped_rag.embeddings import VertexEmbedder
from luma_scoped_rag.models import vector_literal


class FakeCredentials(Credentials):
    def __init__(self):
        super().__init__()
        self.token = "fake-test-only-oauth-token"  # noqa: S105

    @property
    def valid(self):
        return True

    def refresh(self, request):  # pragma: no cover
        raise AssertionError("credentials refresh should not occur in tests")

    def apply(self, headers, token=None):
        headers["Authorization"] = f"Bearer {token or self.token}"


def test_vertex_model_is_used_for_query_and_document_with_same_dimensions():
    captures = []

    def mocked(request: httpx.Request) -> httpx.Response:
        import json

        body = json.loads(request.content)
        captures.append((str(request.url), body))
        assert request.headers["Authorization"] == "Bearer fake-test-only-oauth-token"
        return httpx.Response(200, json={
            "predictions": [{"embeddings": {"values": [0.5] + [0.0] * 767}}]
        })

    client = httpx.Client(transport=httpx.MockTransport(mocked))
    embedder = VertexEmbedder(
        "luma-learning-intelligence", credentials=FakeCredentials(), transport=client,
    )
    assert len(embedder.embed_query("pregunta en espanol")) == 768
    assert len(embedder.embed_document("documento autorizado")) == 768
    assert captures[0][1]["instances"][0]["task_type"] == "RETRIEVAL_QUERY"
    assert captures[1][1]["instances"][0]["task_type"] == "RETRIEVAL_DOCUMENT"
    assert "text-multilingual-embedding-002" in captures[0][0]
    assert all(x[1]["parameters"]["autoTruncate"] is False for x in captures)


def test_invalid_embedding_never_enters_pgvector():
    for invalid in [[0.0] * 768, [float("nan")] + [1.0] * 767, [1.0] * 16]:
        with pytest.raises(ValueError):
            vector_literal(invalid)
    assert vector_literal([1.0] + [0.0] * 767).startswith("[1,")
