"""Offline administrative workflows. Never expose these as HTTP routes."""
from __future__ import annotations

import secrets
from typing import Protocol

import psycopg
from pydantic import Field, field_validator

from .models import Scope, StrictModel, sanitized_metadata, vector_literal
from .repository import key_digest


class DocumentEmbedder(Protocol):
    def embed_document(self, text: str) -> list[float]: ...


class Segment(StrictModel):
    chunk_id: str = Field(min_length=1, max_length=256)
    text: str = Field(min_length=1, max_length=4096)
    start_seconds: int = Field(ge=0, le=86399)
    end_seconds: int = Field(gt=0, le=86399)

    @field_validator("chunk_id")
    @classmethod
    def safe_chunk_id(cls, value: str) -> str:
        return sanitized_metadata(value, 256)


class SourceIngest(StrictModel):
    scope: Scope
    source_id: str = Field(min_length=1, max_length=256)
    drive_file_id: str = Field(default="", max_length=256)
    module: str = Field(default="", max_length=256)
    title: str = Field(min_length=1, max_length=256)
    drive_url: str = Field(min_length=1, max_length=2048)
    license_reference: str = Field(min_length=1, max_length=256)
    segments: list[Segment] = Field(min_length=1, max_length=10000)

    @field_validator("source_id", "title", "license_reference")
    @classmethod
    def safe_field(cls, value: str) -> str:
        return sanitized_metadata(value, 256)

    @field_validator("drive_url")
    @classmethod
    def safe_source_url(cls, value: str) -> str:
        from .models import EvidenceHit

        EvidenceHit(
            tenant_id="validation", program_id="validation", source_id="s", chunk_id="c",
            drive_file_id="", module="", title="t", text="t",
            start_seconds=0, end_seconds=1, start_clock="00:00:00",
            end_clock="00:00:01", drive_url=value,
        )
        return value


def provision_token(
    conn: psycopg.Connection,
    pepper: str,
    scope: Scope,
    expires_at,
) -> str:
    """Return secret ONCE to the operator. Store only its HMAC digest."""
    token = "lrag_" + secrets.token_urlsafe(36)
    digest = key_digest(token, pepper)
    with conn.transaction():
        conn.execute(
            """INSERT INTO luma_rag.access_grants
                   (token_digest, tenant_id, program_id, expires_at)
                   VALUES (%s, %s, %s, %s)""",
            (digest, scope.tenant_id, scope.program_id, expires_at),
        )
    return token


def revoke_token(conn: psycopg.Connection, pepper: str, token: str) -> int:
    with conn.transaction():
        result = conn.execute(
            """UPDATE luma_rag.access_grants SET revoked_at = now()
               WHERE token_digest = %s AND revoked_at IS NULL""",
            (key_digest(token, pepper),),
        )
        return result.rowcount


def stage_source(
    conn: psycopg.Connection,
    source: SourceIngest,
    embedder: DocumentEmbedder,
    embedding_model: str,
) -> int:
    """Explicit tenant/program + authorized license evidence; no auto-approval."""
    if len({segment.chunk_id for segment in source.segments}) != len(source.segments):
        raise ValueError("duplicate chunk IDs in source")
    # Embed before opening a write transaction, avoiding long DB locks.
    vectors = [vector_literal(embedder.embed_document(segment.text)) for segment in source.segments]
    scope = source.scope
    with conn.transaction():
        deleted_before = conn.execute(
            """SELECT 1 FROM luma_rag.source_deletions
               WHERE tenant_id=%s AND program_id=%s AND source_id=%s""",
            (scope.tenant_id, scope.program_id, source.source_id),
        ).fetchone()
        if deleted_before:
            raise ValueError("erased source identity cannot be reingested")
        existing = conn.execute(
            """SELECT release_state FROM luma_rag.sources
               WHERE tenant_id = %s AND program_id = %s AND source_id = %s FOR UPDATE""",
            (scope.tenant_id, scope.program_id, source.source_id),
        ).fetchone()
        if existing and existing[0] != "draft":
            raise ValueError("approved/revoked source cannot be silently reindexed")
        conn.execute(
            """INSERT INTO luma_rag.sources
                (tenant_id, program_id, source_id, drive_file_id, module, title,
                 drive_url, embedding_model, license_reference, release_state)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'draft')
               ON CONFLICT (tenant_id, program_id, source_id) DO UPDATE SET
                 drive_file_id=EXCLUDED.drive_file_id,
                 module=EXCLUDED.module, title=EXCLUDED.title,
                 drive_url=EXCLUDED.drive_url,
                 embedding_model=EXCLUDED.embedding_model,
                 license_reference=EXCLUDED.license_reference,
                 updated_at=now()""",
            (
                scope.tenant_id, scope.program_id, source.source_id,
                source.drive_file_id, source.module, source.title,
                source.drive_url, embedding_model, source.license_reference,
            ),
        )
        conn.execute(
            """DELETE FROM luma_rag.chunks
               WHERE tenant_id=%s AND program_id=%s AND source_id=%s""",
            (scope.tenant_id, scope.program_id, source.source_id),
        )
        for segment, vector in zip(source.segments, vectors, strict=True):
            if segment.end_seconds <= segment.start_seconds:
                raise ValueError("segment timestamps must be increasing")
            conn.execute(
                """INSERT INTO luma_rag.chunks
                   (tenant_id, program_id, source_id, chunk_id, content,
                    start_seconds, end_seconds, embedding)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s::vector(768))""",
                (
                    scope.tenant_id, scope.program_id, source.source_id, segment.chunk_id,
                    segment.text, segment.start_seconds, segment.end_seconds, vector,
                ),
            )
    return len(source.segments)


def approve_source(
    conn: psycopg.Connection,
    scope: Scope,
    source_id: str,
    reviewer: str,
) -> None:
    sanitized_metadata(source_id, 256)
    sanitized_metadata(reviewer, 128)
    with conn.transaction():
        result = conn.execute(
            """UPDATE luma_rag.sources s
               SET release_state='approved', approved_at=now(), approved_by=%s,
                   updated_at=now()
               WHERE tenant_id=%s AND program_id=%s AND source_id=%s
                 AND release_state='draft' AND deleted_at IS NULL
                 AND EXISTS (
                   SELECT 1 FROM luma_rag.chunks c
                   WHERE c.tenant_id=s.tenant_id AND c.program_id=s.program_id
                     AND c.source_id=s.source_id)
               RETURNING source_id""",
            (reviewer, scope.tenant_id, scope.program_id, source_id),
        ).fetchone()
        if not result:
            raise ValueError("source missing, not in draft, or no indexed evidence")


def delete_source(
    conn: psycopg.Connection,
    scope: Scope,
    source_id: str,
    reason_code: str,
) -> None:
    """Hard-delete source and embeddings with an ID-only tombstone."""
    sanitized_metadata(source_id, 256)
    sanitized_metadata(reason_code, 128)
    with conn.transaction():
        conn.execute(
            """DELETE FROM luma_rag.sources
               WHERE tenant_id=%s AND program_id=%s AND source_id=%s""",
            (scope.tenant_id, scope.program_id, source_id),
        )
        conn.execute(
            """INSERT INTO luma_rag.source_deletions
                   (tenant_id,program_id,source_id,reason_code)
                   VALUES (%s,%s,%s,%s)
                   ON CONFLICT (tenant_id,program_id,source_id) DO UPDATE SET
                   removed_at=now(), reason_code=EXCLUDED.reason_code""",
            (scope.tenant_id, scope.program_id, source_id, reason_code),
        )
