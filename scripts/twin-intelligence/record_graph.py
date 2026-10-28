#!/usr/bin/env python3
"""Record only actual source evidence in a separate P0 Graph Harness project.

Never converts code tests into independent review, real pilot proof or
production permission. Run AFTER first source commit and verification.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HARNESS_ROOT = Path(os.environ.get(
    "GRAPH_HARNESS_PATH", "/workspace/projects/Graph-harness-sdlc-control-plane"))
sys.path.insert(0, str(HARNESS_ROOT))

from graph_harness.model import NodeStatus  # noqa: E402
from graph_harness.runtime import GraphRuntime  # noqa: E402

BASE = ROOT / "evidence/luma-twin-intelligence-p0-20261027"
PROJECT = BASE / "graph-harness.project.json"
EVENTS = BASE / "graph-harness.events.jsonl"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(runtime: GraphRuntime, node: str, kind: str, rel: str,
           command: str, commit: str, result: str = "PASS") -> None:
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(rel)
    runtime.record_evidence(
        node, actor="source-verifier" if kind != "critic" else "internal-critic",
        kind=kind, result=result, artifact=rel, sha256=digest(path),
        command=command, commit=commit,
        metadata={"source_only": True, "independent_human_review": False},
    )


def main() -> int:
    runtime = GraphRuntime.from_paths(PROJECT, EVENTS)
    commit = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    if subprocess.check_output(
        ["git", "status", "--porcelain"], cwd=ROOT, text=True).strip():
        # Graph output files from a previous invocation may already exist.
        # Use only the source commit, not an uncommitted code baseline.
        print("Working tree must be clean before evidence is bound to a commit.", file=sys.stderr)
        return 2

    checks = ["focused-tests", "focused-lint", "focused-typecheck", "full-unit-regression"]
    for check in checks:
        if (BASE / f"{check}.exit").read_text().strip() != "0":
            print(f"Cannot record PASS: {check} did not exit zero", file=sys.stderr)
            return 3
    first = runtime.state().nodes["spec-072"].status
    if first is NodeStatus.READY:
        runtime.transition("spec-072", actor="spec-producer",
                           target=NodeStatus.RUNNING, reason="Preregister source-only pilot.")
        record(runtime, "spec-072", "spec", "specs/072-luma-twin-intelligence-p0.md",
               "human-first pilot protocol specified", commit)
        runtime.transition("spec-072", actor="spec-producer",
                           target=NodeStatus.REVIEW, reason="Pilot protocol has explicit gates.")
        runtime.transition("spec-072", actor="spec-producer",
                           target=NodeStatus.DONE,
                           reason="Source protocol recorded; human pilot authorization remains separate.")
    next_status = runtime.state().nodes["p0-contracts"].status
    if next_status is NodeStatus.READY:
        runtime.transition("p0-contracts", actor="implementation-producer",
                           target=NodeStatus.RUNNING,
                           reason="Source contracts verified with targeted and broad tests.")
        record(runtime, "p0-contracts", "test",
               "evidence/luma-twin-intelligence-p0-20261027/focused-tests.log",
               "vitest run src/lib/twin-intelligence src/app/api/twin-intelligence", commit)
        record(runtime, "p0-contracts", "test",
               "evidence/luma-twin-intelligence-p0-20261027/full-unit-regression.log",
               "vitest run --maxWorkers=1 --no-file-parallelism", commit)
        record(runtime, "p0-contracts", "typecheck",
               "evidence/luma-twin-intelligence-p0-20261027/focused-typecheck.exit",
               "tsc --project tsconfig.twin-p0.temporary.json --noEmit", commit)
        record(runtime, "p0-contracts", "lint",
               "evidence/luma-twin-intelligence-p0-20261027/focused-lint.exit",
               "eslint src/lib/twin-intelligence src/app/api/twin-intelligence", commit)
        record(runtime, "p0-contracts", "critic",
               "evidence/luma-twin-intelligence-p0-20261027/adversarial-review.md",
               "internal adversarial code and product review", commit, result="REVIEW_REQUIRED")
        runtime.transition("p0-contracts", actor="implementation-producer",
                           target=NodeStatus.REVIEW,
                           reason="Tests pass; external independent reviewer is NOT signed.")
    runtime.checkpoint(
        actor="source-verifier", label="P0_SOURCE_ONLY_NO_PRODUCTION_GO",
        commit=commit,
        evidence_summary={"focused_test_count": 39, "full_test_count": 370,
                          "full_skipped": 81, "independent_review": "PENDING",
                          "real_pilot": "NOT_STARTED", "production": "NOT_AUTHORIZED"},
    )
    (BASE / "graph-harness-state.json").write_text(
        json.dumps(runtime.as_dict(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8")
    print(json.dumps({
        "commit": commit,
        "nodes": {k: v.status.value for k, v in runtime.state().nodes.items()},
        "result": "PARTIAL_WITH_DOCUMENTED_BLOCKERS"
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
