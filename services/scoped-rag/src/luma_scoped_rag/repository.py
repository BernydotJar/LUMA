from __future__ import annotations

import hashlib
import hmac
from collections.abc import Callable

import psycopg
from psycopg.rows import dict_row

from .models import EvidenceHit, Scope, clock, vector_literal

# Force the tenant+program-filtered candidates to materialize BEFORE vector
# ranking. This is exact ranking; never top-K globally then post-filter.
SCOPED_SEARCH_SQL = """
WITH permitted AS MATERIALIZED (
  SELECT c.tenant_id, c.program_id, c.source_id, c.chunk_id, c.content,
         c.start_seconds, c.end_seconds, c.embedding, s.module, s.title,
         s.drive_file_id, s.drive_url
  FROM luma_rag.chunks c
  INNER JOIN luma_rag.sources s
    ON s.tenant_id = c.tenant_id AND s.program_id = c.program_id
   AND s.source_id = c.source_id
  WHERE c.tenant_id = %s AND c.program_id = %s
    AND s.tenant_id = %s AND s.program_id = %s
    AND s.embedding_model = %s AND s.release_state = 'approved'
    AND s.deleted_at IS NULL
)
SELECT tenant_id, program_id, source_id, chunk_id, content,
       start_seconds, end_seconds, module, title, drive_file_id, drive_url,
       (embedding <=> %s::vector(768)) AS distance
FROM permitted
ORDER BY distance ASC, source_id ASC, chunk_id ASC
LIMIT %s
"""


class Unauthorized(Exception):
    """Invalid or absent backend grant; do not reveal which token/scope failed."""


class Forbidden(Exception):
    """Valid bearer, but not granted this tenant/program."""


ConnectionFactory = Callable[[], psycopg.Connection]


def key_digest(token: str, pepper: str) -> str:
    if len(pepper.encode("utf-8")) < 32:
        raise ValueError("LUMA_RAG_AUTH_PEPPER must be at least 32 bytes")
    return hmac.new(pepper.encode(), token.encode(), hashlib.sha256).hexdigest()


class PgScopedRepository:
    """A DB connection is bound to scope only within one transaction."""

    def __init__(
        self,
        database_url: str,
        pepper: str,
        embedding_model: str,
        connect: ConnectionFactory | None = None,
    ):
        if not database_url:
            raise ValueError("LUMA_RAG_DATABASE_URL missing")
        if not embedding_model:
            raise ValueError("LUMA_RAG_EMBEDDING_MODEL missing")
        key_digest("lrag_bootstrap", pepper)
        self.pepper = pepper
        self.embedding_model = embedding_model
        self.connect = connect or (lambda: psycopg.connect(
            database_url, autocommit=True, row_factory=dict_row,
            connect_timeout=3, application_name="luma-scoped-rag",
        ))

    @staticmethod
    def _set_scope(conn: psycopg.Connection, scope: Scope) -> None:
        conn.execute("SELECT set_config('luma.rag.tenant_id', %s, true)", (scope.tenant_id,))
        conn.execute("SELECT set_config('luma.rag.program_id', %s, true)", (scope.program_id,))
        conn.execute("SELECT set_config('statement_timeout', '2500', true)")

    @staticmethod
    def _authorization_state(conn: psycopg.Connection, digest: str, scope: Scope) -> None:
        # A valid token in another scope must never obtain a default grant.
        row = conn.execute(
            """SELECT EXISTS(
                   SELECT 1 FROM luma_rag.access_grants
                   WHERE token_digest = %s AND expires_at > now()
                     AND revoked_at IS NULL
                 ) AS valid_token,
                 EXISTS(
                   SELECT 1 FROM luma_rag.access_grants
                   WHERE token_digest = %s AND tenant_id = %s AND program_id = %s
                     AND expires_at > now() AND revoked_at IS NULL
                 ) AS scope_allowed""",
            (digest, digest, scope.tenant_id, scope.program_id),
        ).fetchone()
        if not row or not row["valid_token"]:
            raise Unauthorized()
        if not row["scope_allowed"]:
            raise Forbidden()

    def authorize(self, token: str, scope: Scope) -> None:
        digest = key_digest(token, self.pepper)
        with self.connect() as conn, conn.transaction():
            self._authorization_state(conn, digest, scope)

    def search(
        self, token: str, scope: Scope, vector: list[float], limit: int
    ) -> list[EvidenceHit]:
        digest = key_digest(token, self.pepper)
        embedding = vector_literal(vector)
        with self.connect() as conn, conn.transaction():
            # Reauthorize AFTER external embedding, too, so revoked credentials
            # cannot get answers if revocation occurred during the provider call.
            self._authorization_state(conn, digest, scope)
            self._set_scope(conn, scope)
            rows = conn.execute(
                SCOPED_SEARCH_SQL,
                (
                    scope.tenant_id, scope.program_id,
                    scope.tenant_id, scope.program_id,
                    self.embedding_model, embedding, limit,
                ),
            ).fetchall()
        return [
            EvidenceHit(
                tenant_id=row["tenant_id"],
                program_id=row["program_id"],
                source_id=row["source_id"],
                chunk_id=row["chunk_id"],
                drive_file_id=row["drive_file_id"],
                module=row["module"], title=row["title"], text=row["content"],
                start_seconds=row["start_seconds"], end_seconds=row["end_seconds"],
                start_clock=clock(row["start_seconds"]),
                end_clock=clock(row["end_seconds"]),
                drive_url=row["drive_url"], srt_path="", transcript_path="",
            )
            for row in rows
        ]

    def verify_reader_role(self) -> None:
        """Refuse privileged roles that would bypass the RLS boundary."""
        with self.connect() as conn:
            role = conn.execute(
                "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
            ).fetchone()
            if not role or role["rolsuper"] or role["rolbypassrls"]:
                raise RuntimeError("API DB role may not be SUPERUSER/BYPASSRLS")
            rows = conn.execute(
                """SELECT relname, relrowsecurity, relforcerowsecurity
                   FROM pg_class WHERE oid IN (
                     'luma_rag.sources'::regclass, 'luma_rag.chunks'::regclass
                   )"""
            ).fetchall()
            if len(rows) != 2 or not all(
                row["relrowsecurity"] and row["relforcerowsecurity"] for row in rows
            ):
                raise RuntimeError("tenant/program RLS is not forced")
            rights = conn.execute(
                """SELECT bool_or(
                     has_table_privilege(current_user, table_name, privilege)
                   ) AS can_mutate
                   FROM (VALUES
                     ('luma_rag.chunks'),
                     ('luma_rag.sources'),
                     ('luma_rag.access_grants'),
                     ('luma_rag.source_deletions')
                   ) AS protected(table_name)
                   CROSS JOIN (VALUES
                     ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')
                   ) AS mutations(privilege)"""
            ).fetchone()
            if rights["can_mutate"] or conn.execute(
                "SELECT has_schema_privilege(current_user, 'luma_rag', 'CREATE') AS allowed"
            ).fetchone()["allowed"]:
                raise RuntimeError("search API role must be read-only across all RAG tables")
