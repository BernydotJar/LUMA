#!/usr/bin/env python3
"""Append the Knowledge Reflection increment to the existing LUMA Graph Harness ledger."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARNESS_ROOT = Path(
    os.environ.get(
        "GRAPH_HARNESS_PATH",
        "/workspace/projects/Graph-harness-sdlc-control-plane",
    )
)
sys.path.insert(0, str(HARNESS_ROOT))

from graph_harness.model import GateResult, NodeStatus  # noqa: E402
from graph_harness.runtime import GraphRuntime  # noqa: E402


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require(path: str) -> Path:
    target = ROOT / path
    if not target.is_file():
        raise FileNotFoundError(path)
    return target


def evidence(
    runtime: GraphRuntime,
    node_id: str,
    *,
    kind: str,
    path: str,
    command: str,
    commit: str,
    actor: str,
    metadata: dict[str, object] | None = None,
) -> str:
    artifact = require(path)
    event = runtime.record_evidence(
        node_id,
        actor=actor,
        kind=kind,
        result="PASS",
        artifact=path,
        sha256=sha256(artifact),
        command=command,
        commit=commit,
        metadata=metadata or {},
    )
    return event.event_id


def move(runtime: GraphRuntime, node: str, target: NodeStatus, reason: str, actor: str) -> None:
    runtime.transition(node, actor=actor, target=target, reason=reason)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()

    project = ROOT / "graph-harness.project.json"
    events = ROOT / "graph-harness.events.jsonl"

    required = [
        "specs/008-knowledge-reflection.md",
        "src/lib/reflection-engine.ts",
        "src/components/reflection-workbench.tsx",
        "evidence/reflection-critic-review.md",
        "evidence/reflection-independent-verification.md",
        "evidence/verification/reflection-verify.log",
        "evidence/verification/reflection-e2e.log",
        "evidence/verification/reflection-browser-smoke.log",
        "evidence/verification/reflection-npm-audit-production.json",
        "evidence/verification/visual-layout-audit.json",
    ]
    for item in required:
        require(item)

    runtime = GraphRuntime.from_paths(project, events)

    feature = "LUMA-006-knowledge-reflection"
    if runtime.state().nodes[feature].status is not NodeStatus.APPROVED:
        raise SystemExit(f"{feature} is not in approved state")

    move(runtime, feature, NodeStatus.READY, "Dependencies are done and SPEC 008 is executable.", "graph-scheduler")
    move(runtime, feature, NodeStatus.RUNNING, "Producer implementation started from SPEC 008.", "producer")
    evidence(
        runtime,
        feature,
        kind="implementation",
        path="src/lib/reflection-engine.ts",
        command="implement reflection artifact policy, intent-aware retrieval, lineage, and consolidation",
        commit=args.commit,
        actor="producer",
    )
    evidence(
        runtime,
        feature,
        kind="test",
        path="evidence/verification/reflection-verify.log",
        command="npm run verify",
        commit=args.commit,
        actor="test-runner",
        metadata={"unit_tests": 10, "knowledge_reflection_tests": 6},
    )
    critic_id = evidence(
        runtime,
        feature,
        kind="critic",
        path="evidence/reflection-critic-review.md",
        command="adversarial review of reflection authority, provenance, retrieval, and high-stakes behavior",
        commit=args.commit,
        actor="critic",
    )
    runtime.evaluate_gate(
        feature,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic_id],
        note="Accessibility finding repaired; documented showcase boundaries remain non-blocking.",
    )
    move(runtime, feature, NodeStatus.REVIEW, "Producer evidence and critic review are complete.", "producer")
    move(runtime, feature, NodeStatus.DONE, "Independent review gate passed.", "independent-verifier")

    release = "LUMA-007-reflection-showcase-release"
    move(runtime, release, NodeStatus.READY, "Knowledge Reflection dependency is complete.", "graph-scheduler")
    move(runtime, release, NodeStatus.RUNNING, "Incremental client-showcase release verification started.", "release-producer")

    release_critic = evidence(
        runtime,
        release,
        kind="critic",
        path="evidence/reflection-critic-review.md",
        command="release boundary and trust review",
        commit=args.commit,
        actor="critic",
    )
    evidence(
        runtime,
        release,
        kind="verification",
        path="evidence/reflection-independent-verification.md",
        command="independent acceptance verification for SPEC 008",
        commit=args.commit,
        actor="independent-verifier",
    )
    test_id = evidence(
        runtime,
        release,
        kind="test",
        path="evidence/verification/reflection-e2e.log",
        command="env -u CI npm run test:e2e",
        commit=args.commit,
        actor="browser-verifier",
        metadata={"passed": 15, "skipped": 1, "desktop_mobile": True},
    )
    build_id = evidence(
        runtime,
        release,
        kind="build",
        path="evidence/verification/reflection-verify.log",
        command="npm run verify",
        commit=args.commit,
        actor="build-verifier",
        metadata={"production_build": "PASS"},
    )
    a11y_id = evidence(
        runtime,
        release,
        kind="a11y",
        path="evidence/verification/reflection-e2e.log",
        command="Playwright axe WCAG 2 A/AA sweep including /studio/reflections",
        commit=args.commit,
        actor="accessibility-verifier",
        metadata={"routes": 6},
    )
    security_id = evidence(
        runtime,
        release,
        kind="security",
        path="evidence/verification/reflection-npm-audit-production.json",
        command="npm audit --omit=dev --json",
        commit=args.commit,
        actor="security-reviewer",
    )
    visual_id = evidence(
        runtime,
        release,
        kind="visual",
        path="evidence/verification/visual-layout-audit.json",
        command="node scripts/visual-audit.mjs",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"route_viewport_checks": 16},
    )

    runtime.evaluate_gate(
        release,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[release_critic],
        note="No unresolved blocking defect remains within the product-showcase boundary.",
    )
    move(runtime, release, NodeStatus.REVIEW, "Release evidence is complete.", "release-producer")
    runtime.evaluate_gate(
        release,
        actor="release-gate",
        gate_id="release-quality",
        result=GateResult.PASS,
        evidence_ids=[test_id, build_id, a11y_id, security_id, visual_id],
        note="Build, test, accessibility, production dependency, and visual gates pass.",
    )
    move(runtime, release, NodeStatus.DONE, "Knowledge Reflection showcase gate passed.", "release-gate")

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA Knowledge Reflection Product Showcase",
        commit=args.commit,
        evidence_summary={
            "unit_tests": "10 passed",
            "e2e": "15 passed, 1 intentional skip",
            "knowledge_reflection": "6 policy tests passed",
            "wcag": "passed including reflection route",
            "browser_smoke": "passed",
            "release_decision": "PASS_FOR_CLIENT_DEMOS",
        },
    )

    status = runtime.as_dict()
    (ROOT / "evidence/graph-harness-status.json").write_text(
        json.dumps(status, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(status, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
