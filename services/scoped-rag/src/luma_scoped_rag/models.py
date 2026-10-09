from __future__ import annotations

import math
import re
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


def valid_id(value: str, maximum: int = 128) -> bool:
    return (
        isinstance(value, str)
        and 1 <= len(value) <= maximum
        and "/" not in value
        and "\\" not in value
        and all(ord(char) >= 32 and ord(char) != 127 for char in value)
    )


class Scope(StrictModel):
    tenant_id: str = Field(min_length=1, max_length=128)
    program_id: str = Field(min_length=1, max_length=128)

    @field_validator("tenant_id", "program_id")
    @classmethod
    def safe_scope(cls, value: str) -> str:
        if not valid_id(value):
            raise ValueError("invalid tenant or program identifier")
        return value


class SearchRequest(StrictModel):
    query: str = Field(min_length=1, max_length=2048)
    limit: int = Field(default=5, ge=1, le=8)
    scope: Scope

    @field_validator("query")
    @classmethod
    def nonempty_query(cls, value: str) -> str:
        result = value.strip()
        if not result or any(ord(c) < 32 and c not in "\n\t" for c in result):
            raise ValueError("invalid search query")
        return result


class EvidenceHit(StrictModel):
    tenant_id: str
    program_id: str
    source_id: str
    chunk_id: str
    drive_file_id: str
    module: str
    title: str
    text: str
    start_seconds: int
    end_seconds: int
    start_clock: str
    end_clock: str
    drive_url: str
    srt_path: str = ""
    transcript_path: str = ""

    @field_validator("drive_url")
    @classmethod
    def https_link(cls, value: str) -> str:
        url = urlparse(value)
        if url.scheme != "https" or not url.netloc or url.username or url.password:
            raise ValueError("source links must use credential-free HTTPS")
        if len(value) > 2048:
            raise ValueError("source URL too long")
        return value


class SearchResponse(StrictModel):
    scope: Scope
    retrieval: str = "scoped_pgvector_exact"
    results: list[EvidenceHit] = Field(max_length=8)


def clock(seconds: int) -> str:
    if not 0 <= seconds <= 86399:
        raise ValueError("timestamp out of range")
    hours, remainder = divmod(seconds, 3600)
    minutes, remainder = divmod(remainder, 60)
    return f"{hours:02d}:{minutes:02d}:{remainder:02d}"


def finite_vector(values: list[float], expected: int = 768) -> list[float]:
    if len(values) != expected or not all(math.isfinite(value) for value in values):
        raise ValueError("invalid embedding dimension/values")
    if not any(value != 0 for value in values):
        raise ValueError("zero embedding is not allowed for cosine distance")
    return values


def vector_literal(values: list[float]) -> str:
    finite_vector(values)
    return "[" + ",".join(format(float(value), ".9g") for value in values) + "]"


def sanitized_metadata(value: str, maximum: int) -> str:
    if not value or len(value) > maximum or re.search(r"[\x00-\x1f\x7f]", value):
        raise ValueError("invalid source metadata")
    return value
