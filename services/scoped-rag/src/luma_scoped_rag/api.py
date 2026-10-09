from __future__ import annotations

import logging
import os
import re
import uuid
from typing import Protocol

import httpx
import psycopg
from fastapi import FastAPI, Header, HTTPException, Response
from pydantic import ValidationError

from .embeddings import VertexEmbedder
from .http_limits import SearchBodyLimitMiddleware
from .models import EvidenceHit, SearchRequest, SearchResponse
from .repository import Forbidden, PgScopedRepository, Unauthorized

logger = logging.getLogger("luma.scoped_rag")
BEARER_PATTERN = re.compile(r"^Bearer (lrag_[A-Za-z0-9_-]{35,100})$")


class Embedder(Protocol):
    def embed_query(self, text: str) -> list[float]: ...


class Repository(Protocol):
    def authorize(self, token: str, scope: object) -> None: ...
    def search(
        self, token: str, scope: object, vector: list[float], limit: int
    ) -> list[EvidenceHit]: ...
    def verify_reader_role(self) -> None: ...


def create_app(repository: Repository, embedder: Embedder) -> FastAPI:
    app = FastAPI(title="LUMA Scoped RAG", version="0.1.0", docs_url=None, redoc_url=None)
    app.add_middleware(SearchBodyLimitMiddleware)

    @app.middleware("http")
    async def safe_headers(request, call_next):  # noqa: ANN001, ANN202
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @app.get("/healthz")
    def health() -> dict[str, str]:
        return {"status": "up"}  # No customer corpus counts or secrets.

    @app.get("/readyz")
    def ready() -> dict[str, str]:
        try:
            repository.verify_reader_role()
        except (psycopg.Error, RuntimeError):
            raise HTTPException(status_code=503, detail="not_ready") from None
        return {"status": "ready"}

    @app.post("/v1/search", response_model=SearchResponse)
    def search(
        payload: SearchRequest,
        response: Response,
        authorization: str | None = Header(default=None),
    ) -> SearchResponse:
        match = BEARER_PATTERN.fullmatch(authorization or "")
        if not match:
            raise HTTPException(status_code=401, detail="authentication_required")
        token = match.group(1)
        correlation = uuid.uuid4().hex
        response.headers["X-Correlation-ID"] = correlation
        try:
            # No provider call or vector indexing without a valid scoped grant.
            repository.authorize(token, payload.scope)
        except Unauthorized:
            raise HTTPException(status_code=401, detail="authentication_required") from None
        except Forbidden:
            raise HTTPException(status_code=403, detail="scope_forbidden") from None
        except (psycopg.Error, RuntimeError):
            logger.warning(
                "rag_auth_dependency_unavailable correlation=%s", correlation
            )
            raise HTTPException(
                status_code=503, detail="retrieval_unavailable"
            ) from None

        try:
            vector = embedder.embed_query(payload.query)
            results = repository.search(token, payload.scope, vector, payload.limit)
            return SearchResponse(scope=payload.scope, results=results)
        except Unauthorized:
            raise HTTPException(status_code=401, detail="authentication_required") from None
        except Forbidden:
            raise HTTPException(status_code=403, detail="scope_forbidden") from None
        except (
            psycopg.Error, RuntimeError, ValueError, ValidationError, KeyError, httpx.HTTPError
        ):
            logger.warning(
                "rag_query_dependency_unavailable correlation=%s", correlation
            )
            raise HTTPException(
                status_code=503, detail="retrieval_unavailable"
            ) from None

    return app


def default_app() -> FastAPI:
    repository = PgScopedRepository(
        database_url=os.environ.get("LUMA_RAG_DATABASE_URL", ""),
        pepper=os.environ.get("LUMA_RAG_AUTH_PEPPER", ""),
        embedding_model=os.environ.get(
            "LUMA_RAG_EMBEDDING_MODEL", "text-multilingual-embedding-002"
        ),
    )
    repository.verify_reader_role()
    embedder = VertexEmbedder(
        project=os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        location=os.environ.get("VERTEX_LOCATION", "us-central1"),
        model=os.environ.get("LUMA_RAG_EMBEDDING_MODEL", "text-multilingual-embedding-002"),
    )
    return create_app(repository, embedder)


# Lazy import avoids demanding production credentials for unit tests/imports.
# Deployment uses: uvicorn luma_scoped_rag.asgi:app --host 0.0.0.0 --port 8080
