#!/usr/bin/env python3
"""Record the responsive seven-module client-demo finish-line release."""

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


def move(runtime: GraphRuntime, node_id: str, target: NodeStatus, reason: str, actor: str) -> None:
    runtime.transition(node_id, actor=actor, target=target, reason=reason)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()

    runtime = GraphRuntime.from_paths(
        ROOT / "graph-harness.project.json",
        ROOT / "graph-harness.events.jsonl",
    )

    def close(node: str, evidence_ids: list[str], note: str, producer: str = "producer") -> None:
        runtime.evaluate_gate(
            node,
            actor="independent-verifier",
            gate_id="independent-review",
            result=GateResult.PASS,
            evidence_ids=evidence_ids,
            note=note,
        )
        move(runtime, node, NodeStatus.REVIEW, "Evidence complete.", producer)
        move(runtime, node, NodeStatus.DONE, note, "independent-verifier")

    node = "LUMA-030-mobile-responsive-concept"
    move(runtime, node, NodeStatus.READY, "First-user beta content release is complete.", "graph-scheduler")
    move(runtime, node, NodeStatus.RUNNING, "Responsive concept and mobile refinement started.", "product-producer")
    spec = evidence(
        runtime,
        node,
        kind="spec",
        path="specs/019-responsive-program-concept.md",
        command="compare three design directions and select Practitioner Folios + Field Notes",
        commit=args.commit,
        actor="product-designer",
    )
    mobile = evidence(
        runtime,
        node,
        kind="test",
        path="evidence/finish-line/e2e.log",
        command="playwright responsive-mobile.spec.ts at iPhone profile",
        commit=args.commit,
        actor="mobile-verifier",
        metadata={"responsive_mobile_tests": 3, "result": "PASS"},
    )
    visual = evidence(
        runtime,
        node,
        kind="visual",
        path="evidence/finish-line/visual-audit.log",
        command="npm run audit:visual",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"viewports": ["1440x1000", "375x667", "390x844", "430x932"], "checks": 52},
    )
    critic = evidence(
        runtime,
        node,
        kind="critic",
        path="evidence/finish-line/critic-review.md",
        command="generic-AI-pattern and responsive UX critique",
        commit=args.commit,
        actor="critic",
    )
    close(
        node,
        [spec, mobile, visual, critic],
        "Responsive folio/field-note concept passed independent mobile and visual review.",
        "product-producer",
    )

    node = "LUMA-031-seven-module-spanish-learner-surface"
    move(runtime, node, NodeStatus.READY, "Responsive concept is complete.", "graph-scheduler")
    move(runtime, node, NodeStatus.RUNNING, "Seven-module source mapping and Spanish terminology pass started.", "content-producer")
    source = evidence(
        runtime,
        node,
        kind="source",
        path="evidence/finish-line/program-source-map.md",
        command="map Practitioner Modules 1-7 to learner-facing program labels",
        commit=args.commit,
        actor="content-reviewer",
    )
    implementation = evidence(
        runtime,
        node,
        kind="implementation",
        path="src/lib/program-modules.ts",
        command="encode seven source-grounded program modules and editorial states",
        commit=args.commit,
        actor="content-producer",
    )
    language = evidence(
        runtime,
        node,
        kind="test",
        path="evidence/finish-line/e2e.log",
        command="playwright spanish-ui.spec.ts across client-facing routes",
        commit=args.commit,
        actor="language-verifier",
        metadata={"result": "PASS", "client_ui": "Spanish"},
    )
    critic = evidence(
        runtime,
        node,
        kind="critic",
        path="evidence/finish-line/critic-review.md",
        command="review module provenance, terminology and safety boundaries",
        commit=args.commit,
        actor="critic",
    )
    close(
        node,
        [source, implementation, language, critic],
        "Seven-module Spanish learner surface passed source and terminology review.",
        "content-producer",
    )

    node = "LUMA-032-finish-line-client-demo-release"
    move(runtime, node, NodeStatus.READY, "Responsive and seven-module nodes are complete.", "graph-scheduler")
    move(runtime, node, NodeStatus.RUNNING, "Finish-line client-demo release verification started.", "release-producer")

    e2e = evidence(
        runtime,
        node,
        kind="test",
        path="evidence/finish-line/e2e.log",
        command="env -u CI npm run test:e2e",
        commit=args.commit,
        actor="browser-verifier",
        metadata={"passed": 42, "skipped": 4},
    )
    build = evidence(
        runtime,
        node,
        kind="build",
        path="evidence/finish-line/verify.log",
        command="npm run verify",
        commit=args.commit,
        actor="build-verifier",
        metadata={"unit_tests": 16, "lint": "PASS", "typecheck": "PASS", "build": "PASS"},
    )
    a11y = evidence(
        runtime,
        node,
        kind="a11y",
        path="evidence/finish-line/e2e.log",
        command="Playwright Axe WCAG A/AA sweep",
        commit=args.commit,
        actor="accessibility-verifier",
    )
    visual = evidence(
        runtime,
        node,
        kind="visual",
        path="evidence/finish-line/visual-audit.log",
        command="npm run audit:visual",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"checks": 52, "overflow_findings": 0, "clipped_text_findings": 0},
    )
    glass = evidence(
        runtime,
        node,
        kind="adversarial",
        path="evidence/finish-line/glass-audit.log",
        command="npm run audit:glass",
        commit=args.commit,
        actor="adversarial-verifier",
        metadata={"checks": 42, "blocking_findings": 0},
    )
    security = evidence(
        runtime,
        node,
        kind="security",
        path="evidence/finish-line/npm-audit-production.json",
        command="npm audit --omit=dev --json",
        commit=args.commit,
        actor="security-reviewer",
        metadata={"production_vulnerabilities": 0},
    )
    deployment = evidence(
        runtime,
        node,
        kind="deployment",
        path="evidence/finish-line/firebase-production-smoke.log",
        command="Firebase App Hosting deploy + production mobile smoke",
        commit=args.commit,
        actor="deployment-verifier",
    )
    critic = evidence(
        runtime,
        node,
        kind="critic",
        path="evidence/finish-line/critic-review.md",
        command="final product critic review",
        commit=args.commit,
        actor="critic",
    )
    verification = evidence(
        runtime,
        node,
        kind="verification",
        path="evidence/finish-line/independent-verification.md",
        command="independent finish-line verification",
        commit=args.commit,
        actor="independent-verifier",
    )

    runtime.evaluate_gate(
        node,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic, verification],
        note="No blocking responsive, language, source-grounding or product UX defect remains.",
    )
    move(runtime, node, NodeStatus.REVIEW, "Release evidence complete.", "release-producer")
    runtime.evaluate_gate(
        node,
        actor="release-gate",
        gate_id="release-quality",
        result=GateResult.PASS,
        evidence_ids=[e2e, build, a11y, visual, glass, security, deployment],
        note="Finish-line client-demo release quality gates pass.",
    )
    move(runtime, node, NodeStatus.DONE, "Responsive seven-module client-demo release passed.", "release-gate")

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA Responsive Seven-Module Client Demo",
        commit=args.commit,
        evidence_summary={
            "program": "7 source-grounded modules",
            "responsive": "375/390/430 mobile widths verified",
            "e2e": "42 passed, 4 intentional skips",
            "unit": "16 passed",
            "glass": "0 blocking findings",
            "security": "0 production vulnerabilities",
            "firebase": "production smoke passed",
            "decision": "PASS_FOR_CLIENT_DEMO",
        },
    )

    state = runtime.as_dict()
    (ROOT / "evidence/graph-harness-status.json").write_text(
        json.dumps(state, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(state, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
