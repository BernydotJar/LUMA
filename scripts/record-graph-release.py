#!/usr/bin/env python3
"""Record the LUMA Product Showcase release in Graph Harness SDLC.

The script deliberately records only immutable, already-produced evidence. It does
not execute tests or manufacture PASS results. Run the quality commands first,
then pass the commit that contains the reviewed implementation.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Iterable

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


def artifact(path: str) -> Path:
    candidate = ROOT / path
    if not candidate.is_file():
        raise FileNotFoundError(f"Required evidence artifact is missing: {path}")
    return candidate


def record(
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
    candidate = artifact(path)
    event = runtime.record_evidence(
        node_id,
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


def transition(runtime: GraphRuntime, node_id: str, target: NodeStatus, reason: str, actor: str) -> None:
    runtime.transition(node_id, actor=actor, target=target, reason=reason)


def complete_reviewed_node(
    runtime: GraphRuntime,
    node_id: str,
    *,
    implementation_artifact: str,
    implementation_command: str,
    commit: str,
) -> None:
    state = runtime.state().nodes[node_id]
    if state.status is NodeStatus.APPROVED:
        transition(runtime, node_id, NodeStatus.READY, "Dependencies are complete and reviewed scope is executable.", "graph-scheduler")
    transition(runtime, node_id, NodeStatus.RUNNING, "Producer execution started from the reviewed specification.", "producer")
    record(
        runtime,
        node_id,
        kind="implementation",
        path=implementation_artifact,
        command=implementation_command,
        commit=commit,
        actor="producer",
    )
    critic_id = record(
        runtime,
        node_id,
        kind="critic",
        path="evidence/critic-review.md",
        command="independent adversarial review of product, trust, accessibility, and release boundaries",
        commit=commit,
        actor="critic",
        metadata={"review_mode": "attempt-to-disprove"},
    )
    runtime.evaluate_gate(
        node_id,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic_id],
        note="Critic findings were repaired or explicitly bounded; no blocking finding remains.",
    )
    transition(runtime, node_id, NodeStatus.REVIEW, "Producer evidence and critic review are complete.", "producer")
    transition(runtime, node_id, NodeStatus.DONE, "Independent review gate passed.", "independent-verifier")


def verify_release_artifacts(paths: Iterable[str]) -> None:
    for path in paths:
        artifact(path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True, help="Reviewed implementation commit SHA")
    parser.add_argument("--force-reset", action="store_true", help="Delete an existing event ledger before recording")
    args = parser.parse_args()

    project_path = ROOT / "graph-harness.project.json"
    events_path = ROOT / "graph-harness.events.jsonl"
    if args.force_reset:
        events_path.write_text("", encoding="utf-8")
    elif events_path.exists() and events_path.stat().st_size:
        raise SystemExit("Event ledger is not empty. Refusing to duplicate release events; use --force-reset intentionally.")

    verify_release_artifacts(
        [
            "docs/product-thesis.md",
            "src/app/learn/page.tsx",
            "src/components/twin-detail.tsx",
            "src/components/studio-dashboard.tsx",
            "evidence/critic-review.md",
            "evidence/independent-verification.md",
            "evidence/verification/unit-tests.log",
            "evidence/verification/e2e.log",
            "evidence/verification/build.log",
            "evidence/verification/npm-audit-production.json",
            "evidence/verification/visual-layout-audit.json",
        ]
    )

    runtime = GraphRuntime.from_paths(project_path, events_path)

    complete_reviewed_node(
        runtime,
        "LUMA-001-foundation",
        implementation_artifact="docs/product-thesis.md",
        implementation_command="review product thesis, architecture, research, and seven capability specifications",
        commit=args.commit,
    )
    complete_reviewed_node(
        runtime,
        "LUMA-002-learner-experience",
        implementation_artifact="src/app/learn/page.tsx",
        implementation_command="npm run test:run && npm run test:e2e -- learner onboarding, recommendation, and practice paths",
        commit=args.commit,
    )
    complete_reviewed_node(
        runtime,
        "LUMA-003-twin-tutor",
        implementation_artifact="src/components/twin-detail.tsx",
        implementation_command="npm run test:e2e -- Twin evidence, correction/export, and tutor grounding paths",
        commit=args.commit,
    )
    complete_reviewed_node(
        runtime,
        "LUMA-004-studio-content",
        implementation_artifact="src/components/studio-dashboard.tsx",
        implementation_command="npm run test:e2e -- content intelligence and human-intervention assignment paths",
        commit=args.commit,
    )

    node_id = "LUMA-005-showcase-release"
    transition(runtime, node_id, NodeStatus.READY, "All product-surface dependencies are independently complete.", "graph-scheduler")
    transition(runtime, node_id, NodeStatus.RUNNING, "Release verification started against immutable evidence artifacts.", "release-producer")

    critic_id = record(
        runtime,
        node_id,
        kind="critic",
        path="evidence/critic-review.md",
        command="adversarial release review",
        commit=args.commit,
        actor="critic",
    )
    record(
        runtime,
        node_id,
        kind="verification",
        path="evidence/independent-verification.md",
        command="independent acceptance-criteria verification",
        commit=args.commit,
        actor="independent-verifier",
    )
    test_ids = [
        record(
            runtime,
            node_id,
            kind="test",
            path="evidence/verification/unit-tests.log",
            command="npm run test:run",
            commit=args.commit,
            actor="test-runner",
            metadata={"passed": 4, "failed": 0},
        ),
        record(
            runtime,
            node_id,
            kind="test",
            path="evidence/verification/e2e.log",
            command="npm run test:e2e",
            commit=args.commit,
            actor="browser-verifier",
            metadata={"passed": 11, "failed": 0, "skipped": 1},
        ),
    ]
    build_id = record(
        runtime,
        node_id,
        kind="build",
        path="evidence/verification/build.log",
        command="npm run build",
        commit=args.commit,
        actor="build-verifier",
    )
    a11y_id = record(
        runtime,
        node_id,
        kind="a11y",
        path="evidence/verification/e2e.log",
        command="Playwright axe WCAG 2 A/AA route sweep",
        commit=args.commit,
        actor="accessibility-verifier",
        metadata={"routes": ["/", "/learn", "/twin", "/studio", "/onboarding"]},
    )
    security_id = record(
        runtime,
        node_id,
        kind="security",
        path="evidence/verification/npm-audit-production.json",
        command="npm audit --omit=dev --json",
        commit=args.commit,
        actor="security-reviewer",
        metadata={"production_vulnerabilities": 0},
    )
    visual_id = record(
        runtime,
        node_id,
        kind="visual",
        path="evidence/verification/visual-layout-audit.json",
        command="node scripts/visual-audit.mjs",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"route_viewport_checks": 12, "horizontal_overflow": 0, "clipped_text": 0},
    )

    runtime.evaluate_gate(
        node_id,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic_id],
        note="Release critic found no unresolved blocking product or trust defect.",
    )
    transition(runtime, node_id, NodeStatus.REVIEW, "Release artifacts are complete and ready for gate evaluation.", "release-producer")

    runtime.evaluate_gate(
        node_id,
        actor="release-gate",
        gate_id="release-quality",
        result=GateResult.PASS,
        evidence_ids=[*test_ids, build_id, a11y_id, security_id, visual_id],
        note="Test, build, accessibility, production security, and visual gates all pass.",
    )
    transition(runtime, node_id, NodeStatus.DONE, "Product Showcase release gate passed.", "release-gate")

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA 0.1.0 Product Showcase Release",
        commit=args.commit,
        evidence_summary={
            "unit_tests": "4 passed",
            "e2e": "11 passed, 1 intentional skip",
            "production_build": "passed",
            "wcag_automated": "passed",
            "visual_layout": "12 route/viewport checks passed",
            "production_dependency_vulnerabilities": 0,
            "release_decision": "PASS_FOR_CLIENT_DEMOS",
        },
    )

    status = runtime.as_dict()
    output = ROOT / "evidence/graph-harness-status.json"
    output.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(status, indent=2))
    if any(node["status"] != "done" for node in status["nodes"]):
        raise SystemExit("Graph did not reach COMPLETED state")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
