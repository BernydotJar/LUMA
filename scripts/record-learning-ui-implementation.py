#!/usr/bin/env python3
"""Record actual 070/071 producer evidence; never self-approve independent review."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARNESS_ROOT = Path(os.environ.get("GRAPH_HARNESS_PATH", "/workspace/projects/Graph-harness-sdlc-control-plane"))
sys.path.insert(0, str(HARNESS_ROOT))
from graph_harness.model import NodeStatus  # noqa: E402
from graph_harness.runtime import GraphRuntime  # noqa: E402

def require(rel: str, *markers: str) -> Path:
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"missing evidence: {rel}")
    value = path.read_text(encoding="utf-8", errors="replace")
    if any(marker not in value for marker in markers):
        raise RuntimeError(f"verification artifact {rel} lacks expected markers: {markers}")
    return path

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def add(rt: GraphRuntime, node: str, kind: str, path: str, command: str, commit: str, actor: str):
    return rt.record_evidence(
        node,
        actor=actor,
        kind=kind,
        result="PASS",
        artifact=path,
        sha256=sha(ROOT / path),
        command=command,
        commit=commit,
        metadata={"reviewer_independent": False},
    )

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", required=True, help="Immutable source commit containing verification artifacts")
    args = ap.parse_args()
    if len(args.commit) != 40 or any(ch not in "0123456789abcdef" for ch in args.commit):
        raise ValueError("expected full 40-character source commit")

    require("evidence/learning-ui/verify-070-071.log", "334 passed", "Compiled successfully")
    require("evidence/learning-ui/build-070-071.log", "Compiled successfully", "/api/learning/entry-assessment")
    require("evidence/learning-ui/playwright-070-071.log", "20 passed")
    require("evidence/learning-ui/firestore-070-071.log", "6 passed", "Script exited successfully")
    require("evidence/learning-ui/implementation-acceptance-070-071.md", "Independent critic not assigned")
    for name in ("assessment-guest-chromium.png", "assessment-guest-mobile.png",
                 "tutor-class-chromium.png", "tutor-class-mobile.png"):
        if not (ROOT / "evidence/learning-ui" / name).is_file():
            raise RuntimeError(f"missing screenshot {name}")

    rt = GraphRuntime.from_paths(ROOT / "graph-harness.project.json", ROOT / "graph-harness.events.jsonl")
    scenarios = (
        ("LUMA-070-program-entry-assessment", "src/lib/program-assessment.ts"),
        ("LUMA-071-contextual-learning-assistant", "src/lib/learning-context.ts"),
    )
    for node, implementation in scenarios:
        status = rt.state().nodes[node].status
        if status is NodeStatus.RUNNING:
            continue
        if status is NodeStatus.APPROVED:
            rt.transition(node, actor="graph-scheduler", target=NodeStatus.READY,
                          reason="Inventory node LUMA-069 is done; implementation can begin.")
            status = NodeStatus.READY
        if status is not NodeStatus.READY:
            raise RuntimeError(f"{node}: expected approved/ready, got {status.value}")
        rt.transition(node, actor="implementation-engineer", target=NodeStatus.RUNNING,
                      reason="Feature implementation and authenticated-scope controls started from the approved graph specification.")
        add(rt, node, "implementation", implementation, "inspect implemented product capability and executable contracts",
            args.commit, "implementation-engineer")
        add(rt, node, "test", "evidence/learning-ui/verify-070-071.log",
            "npm run lint && npm run typecheck && npm run test:run && npm run build",
            args.commit, "test-producer")
        add(rt, node, "test", "evidence/learning-ui/playwright-070-071.log",
            "Playwright 20 browser scenarios (Chromium desktop/mobile)",
            args.commit, "browser-test-producer")
        add(rt, node, "test", "evidence/learning-ui/firestore-070-071.log",
            "Firebase Firestore Emulator: isolation and concurrent assessment acceptance",
            args.commit, "emulator-test-producer")
        add(rt, node, "review-request", "evidence/learning-ui/implementation-acceptance-070-071.md",
            "producer release-readiness matrix and explicit unresolved acceptance blockers",
            args.commit, "implementation-engineer")
        # The graph intentionally requires independent-review PASS to ENTER
        # review; producer evidence alone cannot legally advance the node.
        # Leave it RUNNING until an independent critic signs evidence.

    # No fake critic / independent-verifier evidence is recorded. No gate is passed.
    status = rt.as_dict()
    target = ROOT / "evidence/graph-harness-status.json"
    target.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    for node, _ in scenarios:
        state = rt.state().nodes[node]
        print(json.dumps({
            "node": node,
            "status": state.status.value,
            "independent_review": "NOT_EVALUATED",
            "artifact_count": len(state.active_evidence()),
        }))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
