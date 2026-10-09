from __future__ import annotations

import re

import google.auth
import httpx
from google.auth.credentials import Credentials
from google.auth.transport.requests import Request

from .models import finite_vector


class VertexEmbedder:
    """Google-first query/document embeddings with identical 768-D model.

    Google authentication is via ADC/workload identity, not user JSON keys.
    No query text or credentials are logged by this component.
    """

    def __init__(
        self,
        project: str,
        location: str = "us-central1",
        model: str = "text-multilingual-embedding-002",
        timeout: float = 2.4,
        credentials: Credentials | None = None,
        transport: httpx.Client | None = None,
    ):
        if not re.fullmatch(r"[a-z][a-z0-9-]{4,62}", project):
            raise ValueError("Invalid Vertex AI project ID")
        if not re.fullmatch(r"[a-z]+-[a-z0-9]+[0-9]", location):
            raise ValueError("Invalid Vertex AI region")
        if not re.fullmatch(r"[a-z][a-z0-9-]{2,63}", model):
            raise ValueError("Invalid embedding model name")
        self.endpoint = (
            f"https://{location}-aiplatform.googleapis.com/v1/projects/{project}"
            f"/locations/{location}/publishers/google/models/{model}:predict"
        )
        self.timeout = timeout
        self.credentials = credentials
        self.transport = transport or httpx.Client(timeout=timeout, follow_redirects=False)

    def embed(self, text: str, task_type: str) -> list[float]:
        if task_type not in {"RETRIEVAL_QUERY", "RETRIEVAL_DOCUMENT"}:
            raise ValueError("Unsupported embedding task")
        if not 1 <= len(text) <= 4096:
            raise ValueError("Embedding input out of bounds")
        credentials = self.credentials
        if credentials is None:
            credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
            self.credentials = credentials
        if not credentials.valid:
            credentials.refresh(Request())
        response = self.transport.post(
            self.endpoint,
            json={
                "instances": [{"content": text, "task_type": task_type}],
                "parameters": {"autoTruncate": False},
            },
            headers={"Authorization": f"Bearer {credentials.token}"},
            timeout=self.timeout,
        )
        response.raise_for_status()
        data = response.json()
        predictions = data.get("predictions", [])
        if len(predictions) != 1:
            raise ValueError("Vertex AI returned an invalid embedding count")
        values = predictions[0]["embeddings"]["values"]
        if not isinstance(values, list):
            raise ValueError("Vertex AI embedding is not a vector")
        return finite_vector(values)

    def embed_query(self, text: str) -> list[float]:
        return self.embed(text, "RETRIEVAL_QUERY")

    def embed_document(self, text: str) -> list[float]:
        return self.embed(text, "RETRIEVAL_DOCUMENT")
