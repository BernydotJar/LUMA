"""Offline operator CLI; never expose these methods in the web API.

All database passwords and the token pepper come from environment variables.
New tokens are written once into a mode-0600 file, never into stdout/logs.
"""
from __future__ import annotations

import argparse
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import psycopg

from .admin import (
    SourceIngest,
    approve_source,
    delete_source,
    provision_token,
    revoke_token,
    stage_source,
)
from .embeddings import VertexEmbedder
from .models import Scope


def _scope(args: argparse.Namespace) -> Scope:
    return Scope(tenant_id=args.tenant, program_id=args.program)


def _safe_secret_file(path: str, token: str) -> None:
    target = Path(path)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    fd = os.open(target, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as file:
        file.write(token + "\n")
        file.flush()
        os.fsync(file.fileno())


def run(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="luma-scoped-rag-admin")
    operations = parser.add_subparsers(dest="operation", required=True)
    for name in ("provision-key", "revoke-key", "stage-source", "approve-source", "delete-source"):
        sub = operations.add_parser(name)
        if name != "revoke-key":
            sub.add_argument("--tenant", required=True)
            sub.add_argument("--program", required=True)
        if name == "provision-key":
            sub.add_argument("--expires-days", type=int, default=30)
            sub.add_argument("--token-output", required=True)
        if name == "revoke-key":
            sub.add_argument("--token-file", required=True)
        if name == "stage-source":
            sub.add_argument("--source-file", required=True)
        if name == "approve-source":
            sub.add_argument("--source-id", required=True)
            sub.add_argument("--reviewer", required=True)
        if name == "delete-source":
            sub.add_argument("--source-id", required=True)
            sub.add_argument("--reason-code", required=True)
    args = parser.parse_args(argv)
    admin_url = os.environ.get("LUMA_RAG_ADMIN_DATABASE_URL")
    if not admin_url:
        parser.error("LUMA_RAG_ADMIN_DATABASE_URL is required (outside of source control)")
    pepper = os.environ.get("LUMA_RAG_AUTH_PEPPER", "")
    if args.operation in ("provision-key", "revoke-key") and len(pepper.encode()) < 32:
        parser.error("LUMA_RAG_AUTH_PEPPER must be at least 32 bytes")

    if args.operation == "provision-key":
        if not (1 <= args.expires_days <= 365):
            parser.error("expires-days must be 1..365")
        if Path(args.token_output).exists():
            parser.error("token output file already exists")
    if args.operation == "stage-source":
        source = SourceIngest.model_validate_json(Path(args.source_file).read_text())
        if source.scope != _scope(args):
            parser.error("source file scope does not match explicit CLI tenant/program")
        project = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
        embedding_model = os.environ.get(
            "LUMA_RAG_EMBEDDING_MODEL", "text-multilingual-embedding-002"
        )
        embedder = VertexEmbedder(project, model=embedding_model)

    with psycopg.connect(admin_url, autocommit=True) as conn:
        if args.operation == "provision-key":
            key = provision_token(
                conn, pepper, _scope(args),
                datetime.now(UTC) + timedelta(days=args.expires_days),
            )
            try:
                _safe_secret_file(args.token_output, key)
            except OSError:
                # Never leave a usable key when a protected handoff fails.
                revoke_token(conn, pepper, key)
                raise
            print("Scope-bound token created; secret stored in a restricted file")
        elif args.operation == "revoke-key":
            token_file = Path(args.token_file)
            if token_file.stat().st_mode & 0o077:
                parser.error("token file must be private (mode 0600)")
            token = token_file.read_text().strip()
            print("Active grants revoked:", revoke_token(conn, pepper, token))
        elif args.operation == "stage-source":
            count = stage_source(conn, source, embedder, embedding_model)
            print("Draft source staged with validated segments:", count)
        elif args.operation == "approve-source":
            approve_source(conn, _scope(args), args.source_id, args.reviewer)
            print("Source approved for exact tenant/program scope")
        elif args.operation == "delete-source":
            delete_source(conn, _scope(args), args.source_id, args.reason_code)
            print("Source and embeddings purged; ID-only deletion receipt recorded")
    return 0


if __name__ == "__main__":
    raise SystemExit(run())
