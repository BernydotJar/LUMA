#!/usr/bin/env python3
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

from graph_harness.model import GateResult, NodeStatus  # noqa: E402
from graph_harness.runtime import GraphRuntime  # noqa: E402

PROJECT = ROOT / "graph-harness.project.json"
EVENTS = ROOT / "graph-harness.events.jsonl"
NODE_ID = "LUMA-056-liquid-glass-functional-layer-v3"
EVIDENCE = ROOT / "evidence/liquid-glass-v3"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def artifact(rel: str) -> Path:
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"missing evidence artifact: {rel}")
    return path


def require_text(rel: str, *needles: str) -> None:
    text = artifact(rel).read_text(encoding="utf-8", errors="replace")
    missing = [needle for needle in needles if needle not in text]
    if missing:
        raise RuntimeError(f"{rel} missing release markers: {missing}")


def validate_evidence() -> None:
    require_text("evidence/liquid-glass-v3/lint.log", "eslint .")
    require_text("evidence/liquid-glass-v3/typecheck.log", "tsc --noEmit")
    require_text("evidence/liquid-glass-v3/unit-tests.log", "95 passed", "10 skipped")
    require_text("evidence/liquid-glass-v3/e2e.log", "4 passed")
    require_text("evidence/liquid-glass-v3/build.log", "Compiled successfully")
    require_text("evidence/liquid-glass-v3/glass-audit.log", "blocking_findings=0", "reduced_transparency_fallback=true")
    require_text("evidence/liquid-glass-v3/critic-review.md", "**PASS.**")
    require_text("evidence/liquid-glass-v3/verification.md", "**PASS**")

    npm_audit = json.loads(artifact("evidence/liquid-glass-v3/npm-audit-production.json").read_text())
    if npm_audit.get("metadata", {}).get("vulnerabilities", {}).get("total") != 0:
        raise RuntimeError("production npm audit is not zero-vulnerability")

    glass = json.loads(artifact("evidence/liquid-glass-v3/glass-report.json").read_text())
    if len(glass.get("checks", [])) != 42 or not glass.get("hasReducedTransparencyFallback"):
        raise RuntimeError("glass adversarial evidence is incomplete")

    browser = json.loads(artifact("evidence/liquid-glass-v3/browser-verification.json").read_text())
    results = browser.get("results", [])
    if len(results) != 4:
        raise RuntimeError(f"expected 4 standalone browser cases, got {len(results)}")
    for result in results:
        if result.get("status") != 200 or result.get("theme") != "light":
            raise RuntimeError(f"standalone route failed: {result}")
        if result.get("overflow", 1) > 0 or result.get("nestedGlass", 1) > 0:
            raise RuntimeError(f"layout/material failure: {result}")
        if result.get("consoleErrors") or result.get("pageErrors") or result.get("badResponses"):
            raise RuntimeError(f"standalone browser errors: {result}")


def record(runtime: GraphRuntime, *, kind: str, path: str, command: str, commit: str, actor: str, metadata: dict | None = None) -> str:
    candidate = artifact(path)
    event = runtime.record_evidence(
        NODE_ID,
        actor=actor,
        kind=kind,
        result="PASS",
        artifact=path,
        sha256=sha256(candidate),
        command=command,
        commit=commit,
        metadata=metadata or {},
    )
    return event.event_id


def transition(runtime: GraphRuntime, target: NodeStatus, reason: str, actor: str) -> None:
    runtime.transition(NODE_ID, actor=actor, target=target, reason=reason)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()

    validate_evidence()
    runtime = GraphRuntime.from_paths(PROJECT, EVENTS)
    status = runtime.state().nodes[NODE_ID].status
    if status is NodeStatus.DONE:
        raise SystemExit(f"{NODE_ID} already done; refusing duplicate evidence")
    if status is NodeStatus.APPROVED:
        transition(runtime, NodeStatus.READY, "V2 architecture baseline complete; v3 evidence is ready.", "graph-scheduler")
        status = NodeStatus.READY
    if status is NodeStatus.READY:
        transition(runtime, NodeStatus.RUNNING, "Producer execution started from the reviewed v3 material contract.", "ui-producer")
    elif status is not NodeStatus.RUNNING:
        raise RuntimeError(f"unexpected node status: {status.value}")

    ids = []
    ids.append(record(runtime, kind="implementation", path="docs/design/liquid-glass-contract.md", command="implement functional-layer placement and bounded-refraction optimization", commit=args.commit, actor="ui-producer", metadata={"extends": "LUMA-036", "material_rule": "glass-as-functional-layer"}))
    ids.append(record(runtime, kind="test", path="evidence/liquid-glass-v3/e2e.log", command="PLAYWRIGHT_PORT=3120 npm run test:e2e -- e2e/liquid-glass-v2.spec.ts", commit=args.commit, actor="browser-verifier", metadata={"passed": 4, "failed": 0}))
    ids.append(record(runtime, kind="visual", path="evidence/liquid-glass-v3/glass-report.json", command="LUMA_AUDIT_URL=http://127.0.0.1:3110 npm run audit:glass", commit=args.commit, actor="visual-verifier", metadata={"checks": 42, "blocking": 0, "coverage_limit": 0.95}))
    ids.append(record(runtime, kind="a11y", path="evidence/liquid-glass-v3/glass-audit.log", command="axe WCAG A/AA glass adversarial sweep", commit=args.commit, actor="accessibility-verifier", metadata={"axe_blocking": 0, "reduced_transparency_fallback": True}))
    ids.append(record(runtime, kind="build", path="evidence/liquid-glass-v3/build.log", command="npm run build", commit=args.commit, actor="build-verifier"))
    ids.append(record(runtime, kind="verification", path="evidence/liquid-glass-v3/browser-verification.json", command="standalone browser smoke: experience/learn/studio/library-mobile", commit=args.commit, actor="independent-verifier", metadata={"routes": 4, "runtime_errors": 0}))
    critic = record(runtime, kind="critic", path="evidence/liquid-glass-v3/critic-review.md", command="independent attempt-to-disprove material review", commit=args.commit, actor="critic", metadata={"review_mode": "attempt-to-disprove"})
    ids.append(critic)

    runtime.evaluate_gate(
        NODE_ID,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=ids,
        note="Functional-layer placement, stricter glass audit, desktop/mobile E2E, production build and standalone smoke pass.",
    )
    transition(runtime, NodeStatus.REVIEW, "Implementation, critic and verification evidence are complete.", "ui-producer")
    transition(runtime, NodeStatus.DONE, "Liquid Glass Functional Layer v3 passes independent review.", "independent-verifier")
    runtime.checkpoint(
        actor="independent-verifier",
        label="LUMA Liquid Glass Functional Layer v3",
        commit=args.commit,
        evidence_summary={
            "decision": "PASS",
            "glass_audit_checks": 42,
            "glass_blocking_findings": 0,
            "unit_tests_passed": 95,
            "e2e_passed": 4,
            "standalone_browser_routes": 4,
            "production_vulnerabilities": 0,
            "library_mobile_coverage": "1.07 -> 0.23",
            "studio_desktop_coverage": "0.69 -> 0.24",
        },
    )

    state = runtime.as_dict()
    (ROOT / "evidence/graph-harness-status.json").write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n")
    output = {
        "status": "PASS",
        "node": NODE_ID,
        "node_status": runtime.state().nodes[NODE_ID].status.value,
        "reviewed_commit": args.commit,
        "event_count": state["event_count"],
    }
    (EVIDENCE / "graph-finalization.json").write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
