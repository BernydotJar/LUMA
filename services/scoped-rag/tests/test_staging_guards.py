"""Verify synthetic staging cannot accidentally target a production database."""
from __future__ import annotations

from types import SimpleNamespace

import pytest


class FakeDatabase:
    def __init__(self, name: str, server_address: str | None, client_host: str):
        self.name = name
        self.server_address = server_address
        self.info = SimpleNamespace(host=client_host)

    def execute(self, _sql: str):
        return self

    def fetchone(self):
        return {"database_name": self.name, "server_address": self.server_address}


def test_synthetic_staging_rejects_production_and_remote_database(monkeypatch):
    from importlib.util import module_from_spec, spec_from_file_location
    from pathlib import Path

    path = Path(__file__).parents[1] / "scripts/staging_http_smoke.py"
    spec = spec_from_file_location("local_staging_smoke_guards", path)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    guard = module._require_disposable_local_database

    monkeypatch.delenv("CI", raising=False)
    assert guard(
        FakeDatabase("luma065_stage", None, "/run/postgresql/local.sock")
    ) == "luma065_stage"
    with pytest.raises(RuntimeError, match="disposable"):
        guard(FakeDatabase("luma_production", None, "/run/postgresql/local.sock"))
    with pytest.raises(RuntimeError, match="non-local"):
        guard(FakeDatabase("luma065_stage", "10.33.1.8", "10.33.1.8"))

    monkeypatch.setenv("CI", "true")
    assert guard(FakeDatabase("luma064_test", "172.21.0.2/32", "localhost")) == "luma064_test"
    with pytest.raises(RuntimeError, match="non-local"):
        guard(FakeDatabase("luma065_stage", "172.21.0.2/32", "localhost"))
    with pytest.raises(RuntimeError, match="non-local"):
        guard(FakeDatabase("luma064_test", "172.21.0.2/32", "example.remote.host"))
    with pytest.raises(RuntimeError, match="unparseable"):
        guard(FakeDatabase("luma064_test", "not-a-valid-address", "localhost"))
