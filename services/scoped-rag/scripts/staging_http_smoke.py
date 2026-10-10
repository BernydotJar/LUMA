"""LUMA-065: localhost-only synthetic HTTP staging for the scoped RAG service.

Runs real Uvicorn/FastAPI + PostgreSQL/pgvector + strict RLS and tests the
entire wire contract. Vertex AI is deliberately replaced by a clearly marked
synthetic test embedding; it is NEVER used in the production ASGI app.
No customer corpus, real API keys, or public endpoints are used.
"""
from __future__ import annotations

import ipaddress
import json
import os
import secrets
import socket
import threading
import time
from datetime import UTC, datetime, timedelta

import psycopg
import requests
import uvicorn

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
from luma_scoped_rag.repository import PgScopedRepository

MODEL = "text-multilingual-embedding-002"
VECTOR = [1.0] + [0.0] * 767


class SyntheticEmbedder:
    """Never deploy: deterministic testing vectors for authorized synthetic text."""

    def __init__(self) -> None:
        self.query_calls = 0

    def embed_document(self, _text: str) -> list[float]:
        return VECTOR

    def embed_query(self, _text: str) -> list[float]:
        self.query_calls += 1
        return VECTOR


def _require_disposable_local_database(conn: psycopg.Connection) -> str:
    record = conn.execute(
        "SELECT current_database() AS database_name, "
        "inet_server_addr()::text AS server_address"
    ).fetchone()
    if isinstance(record, dict):
        database, addr = record["database_name"], record["server_address"]
    else:
        database, addr = record
    if not database.endswith(("_stage", "_test")):
        raise RuntimeError("Refusing synthetic staging outside disposable _stage/_test DB")
    # PostgreSQL's inet textual representation may include a mask (/32 or /128).
    # Parse an interface rather than assuming a naked IPv4/IPv6 address.
    try:
        server_is_loopback = not addr or ipaddress.ip_interface(addr).ip.is_loopback
    except ValueError:
        raise RuntimeError("Refusing unparseable staging database address") from None
    if not server_is_loopback:
        # GitHub-hosted CI connects to its disposable database container via
        # localhost port mapping, while the database itself reports a Docker
        # bridge IP. Only allow that exact CI + _test + loopback client case.
        ci_container = (
            os.environ.get("CI") == "true"
            and database.endswith("_test")
            and conn.info.host in {"localhost", "127.0.0.1", "::1"}
        )
        if not ci_container:
            raise RuntimeError("Refusing synthetic staging against non-local PostgreSQL")
    return database


def _source(scope: Scope, label: str) -> SourceIngest:
    return SourceIngest.model_validate({
        "scope": scope.model_dump(),
        "source_id": "synthetic-learning-video",
        "drive_file_id": f"synthetic-drive-{label}",
        "module": "Synthetic course",
        "title": f"Synthetic practice lesson {label}",
        "drive_url": f"https://example.org/synthetic-video/{label}",
        "license_reference": f"synthetic-no-copyright-{label}",
        "segments": [{
            "chunk_id": "synthetic-chunk-1",
            "text": f"Synthetic evidence for the authorized {label} scope",
            "start_seconds": 15,
            "end_seconds": 30,
        }],
    })


def _assert_http(response: requests.Response, code: int, check: str) -> dict:
    if response.status_code != code:
        raise AssertionError(f"{check}: expected HTTP {code}, got {response.status_code}")
    return response.json()


def run() -> dict:
    admin_dsn = os.environ.get("LUMA_RAG_STAGING_ADMIN_DSN", "")
    reader_dsn = os.environ.get("LUMA_RAG_STAGING_API_DSN", "")
    if not admin_dsn or not reader_dsn:
        raise RuntimeError("Staging admin and read-only DSNs must be supplied")
    pepper = secrets.token_hex(32)  # Volatile synthetic-only staging key.
    nonce = secrets.token_hex(6)
    scopes = (
        Scope(tenant_id=f"synthetic-a-{nonce}", program_id="practice-one"),
        Scope(tenant_id=f"synthetic-a-{nonce}", program_id="practice-two"),
        Scope(tenant_id=f"synthetic-b-{nonce}", program_id="practice-one"),
    )
    embedder = SyntheticEmbedder()
    reader = PgScopedRepository(reader_dsn, pepper, MODEL)
    socket_listener: socket.socket | None = None
    server: uvicorn.Server | None = None
    worker: threading.Thread | None = None
    check_count = 0

    with psycopg.connect(admin_dsn, autocommit=True) as admin:
        target = _require_disposable_local_database(admin)
        with reader.connect() as restricted:
            if _require_disposable_local_database(restricted) != target:
                raise RuntimeError("Staging API and admin DB identities differ")
        reader.verify_reader_role()

        try:
            for scope, label in zip(scopes, ("A1", "A2", "B1"), strict=True):
                stage_source(admin, _source(scope, label), embedder, MODEL)
                approve_source(admin, scope, "synthetic-learning-video", "synthetic-reviewer")
            token_a = provision_token(
                admin, pepper, scopes[0], datetime.now(UTC) + timedelta(minutes=30)
            )
            token_b = provision_token(
                admin, pepper, scopes[2], datetime.now(UTC) + timedelta(minutes=30)
            )

            socket_listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            socket_listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            socket_listener.bind(("127.0.0.1", 0))
            socket_listener.listen(128)
            port = socket_listener.getsockname()[1]
            server = uvicorn.Server(uvicorn.Config(
                create_app(reader, embedder),
                host="127.0.0.1", port=port, log_level="error", access_log=False,
            ))
            worker = threading.Thread(
                target=server.run,
                kwargs={"sockets": [socket_listener]},
                daemon=True,
            )
            worker.start()
            started = time.monotonic()
            while not server.started and time.monotonic() - started < 8:
                if not worker.is_alive():
                    break
                time.sleep(0.04)
            if not server.started:
                raise RuntimeError("Isolated staging Uvicorn did not start")

            base = f"http://127.0.0.1:{port}"
            http = requests.Session()

            def search(scope: Scope, token: str | None = token_a) -> requests.Response:
                headers = {"Content-Type": "application/json"}
                if token:
                    headers["Authorization"] = f"Bearer {token}"
                return http.post(
                    base + "/v1/search",
                    json={"query": "synthetic practice", "limit": 5,
                          "scope": scope.model_dump()},
                    headers=headers, timeout=5,
                )

            readiness = _assert_http(http.get(base + "/readyz", timeout=3), 200, "ready")
            assert readiness["status"] == "ready"
            check_count += 1

            a = _assert_http(search(scopes[0]), 200, "tenant-A/program-one")
            assert a["scope"] == scopes[0].model_dump()
            assert len(a["results"]) == 1
            assert a["results"][0]["text"].endswith("A1 scope")
            assert a["results"][0]["start_clock"] == "00:00:15"
            check_count += 1

            start_calls = embedder.query_calls
            _assert_http(search(scopes[1]), 403, "same-tenant foreign-program")
            _assert_http(search(scopes[2]), 403, "foreign tenant")
            _assert_http(search(scopes[0], token=None), 401, "unsigned request")
            _assert_http(search(scopes[0], token="lrag_" + "z" * 48), 401, "unknown key")
            assert embedder.query_calls == start_calls
            check_count += 4

            b = _assert_http(search(scopes[2], token_b), 200, "tenant-B/program-one")
            assert len(b["results"]) == 1
            assert b["results"][0]["text"].endswith("B1 scope")
            assert b["results"][0]["text"] != a["results"][0]["text"]
            check_count += 1

            too_large = http.post(
                base + "/v1/search",
                data="X" * 9000,
                headers={"Content-Type": "application/json"}, timeout=3,
            )
            _assert_http(too_large, 413, "request-body denial")
            check_count += 1

            assert revoke_token(admin, pepper, token_a) == 1
            _assert_http(search(scopes[0]), 401, "revoke-after-use")
            check_count += 1

            delete_source(admin, scopes[0], "synthetic-learning-video", "STAGING_ERASURE")
            restored_key = provision_token(
                admin, pepper, scopes[0], datetime.now(UTC) + timedelta(minutes=30)
            )
            deleted = _assert_http(search(scopes[0], restored_key), 200, "erased source")
            assert deleted["results"] == []
            check_count += 1

            try:
                stage_source(admin, _source(scopes[0], "REPLAY"), embedder, MODEL)
            except ValueError as error:
                assert "cannot be reingested" in str(error)
                check_count += 1
            else:
                raise AssertionError("Erased source was silently reingested")

            return {
                "result": "PASS", "checks": check_count,
                "database_kind": "DISPOSABLE_LOCAL_ONLY",
                "http_server": "127.0.0.1_EPHEMERAL_STOPPED_AFTER_SMOKE",
                "content_kind": "SYNTHETIC_ONLY",
                "database_enforcement": "FORCED_RLS_AND_EXACT_PRE_RANK_FILTER",
                "vertex": "SYNTHETIC_EMBEDDER_ONLY",
                "external_services_changed": False,
            }
        finally:
            if server:
                server.should_exit = True
            if worker:
                worker.join(timeout=5)
            if socket_listener:
                socket_listener.close()
            with admin.transaction():
                tenant_ids = [scopes[0].tenant_id, scopes[2].tenant_id]
                admin.execute(
                    "DELETE FROM luma_rag.sources WHERE tenant_id = ANY(%s)",
                    (tenant_ids,),
                )
                admin.execute(
                    "DELETE FROM luma_rag.access_grants WHERE tenant_id = ANY(%s)",
                    (tenant_ids,),
                )
                admin.execute(
                    "DELETE FROM luma_rag.source_deletions WHERE tenant_id = ANY(%s)",
                    (tenant_ids,),
                )


if __name__ == "__main__":
    print(json.dumps(run(), sort_keys=True))
