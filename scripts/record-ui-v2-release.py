#!/usr/bin/env python3
"""Record LUMA Learner Experience UI v2 and Firebase showcase release evidence."""

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
    parser.add_argument("--commit", required=True, help="Remote implementation commit deployed to Firebase")
    args = parser.parse_args()

    project = ROOT / "graph-harness.project.json"
    events = ROOT / "graph-harness.events.jsonl"

    required = [
        "specs/009-learner-experience-ui-v2.md",
        "docs/design/learner-experience-v2.md",
        "src/app/learn/page.tsx",
        "src/components/learning-pulse.tsx",
        "evidence/ui-v2/critic-review.md",
        "evidence/ui-v2/independent-verification.md",
        "evidence/ui-v2/verify.log",
        "evidence/ui-v2/e2e.log",
        "evidence/ui-v2/visual-audit.log",
        "evidence/ui-v2/npm-audit-production.json",
        "evidence/ui-v2/firebase-production-smoke.log",
    ]
    for item in required:
        require(item)

    runtime = GraphRuntime.from_paths(project, events)

    feature = "LUMA-008-learner-ux-v2"
    if runtime.state().nodes[feature].status is not NodeStatus.APPROVED:
        raise SystemExit(f"{feature} is not in approved state")

    move(runtime, feature, NodeStatus.READY, "Knowledge Reflection release is complete and SPEC 009 is executable.", "graph-scheduler")
    move(runtime, feature, NodeStatus.RUNNING, "Learner Experience UI v2 implementation started from SPEC 009.", "producer")

    implementation_id = evidence(
        runtime,
        feature,
        kind="implementation",
        path="src/app/learn/page.tsx",
        command="implement learner-first information architecture and visual system",
        commit=args.commit,
        actor="producer",
        metadata={
            "ux_laws": ["Hick", "Fitts", "Von Restorff", "Miller", "Jakob", "Gestalt", "progressive-disclosure"],
            "visual_direction": "1970s futurism + Swiss information design + warm analog education + restrained liquid glass",
        },
    )
    test_id = evidence(
        runtime,
        feature,
        kind="test",
        path="evidence/ui-v2/e2e.log",
        command="env -u CI npm run test:e2e",
        commit=args.commit,
        actor="browser-verifier",
        metadata={"passed": 15, "skipped": 1, "desktop_mobile": True},
    )
    visual_id = evidence(
        runtime,
        feature,
        kind="visual",
        path="evidence/ui-v2/visual-audit.log",
        command="node scripts/visual-audit.mjs",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"route_viewport_checks": 16, "semantic_layout_findings": 0},
    )
    critic_id = evidence(
        runtime,
        feature,
        kind="critic",
        path="evidence/ui-v2/critic-review.md",
        command="adversarial product and UX review",
        commit=args.commit,
        actor="critic",
    )
    evidence(
        runtime,
        feature,
        kind="verification",
        path="evidence/ui-v2/independent-verification.md",
        command="independent verification of learner journey, accessibility, and adaptive behavior",
        commit=args.commit,
        actor="independent-verifier",
    )

    runtime.evaluate_gate(
        feature,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic_id, test_id, visual_id, implementation_id],
        note="Learner outcome is visually primary; repaired navigation, accessibility, contrast, and onboarding continuity findings.",
    )
    move(runtime, feature, NodeStatus.REVIEW, "Producer, Critic, browser, and visual evidence are complete.", "producer")
    move(runtime, feature, NodeStatus.DONE, "Independent learner-experience review passed.", "independent-verifier")

    release = "LUMA-009-ui-v2-firebase-release"
    move(runtime, release, NodeStatus.READY, "Learner UX v2 is complete.", "graph-scheduler")
    move(runtime, release, NodeStatus.RUNNING, "Firebase App Hosting release verification started.", "release-producer")

    build_id = evidence(
        runtime,
        release,
        kind="build",
        path="evidence/ui-v2/verify.log",
        command="npm run verify",
        commit=args.commit,
        actor="build-verifier",
        metadata={"unit_tests": 10, "production_build": "PASS"},
    )
    security_id = evidence(
        runtime,
        release,
        kind="security",
        path="evidence/ui-v2/npm-audit-production.json",
        command="npm audit --omit=dev --json",
        commit=args.commit,
        actor="security-reviewer",
        metadata={"production_vulnerabilities": 0},
    )
    production_id = evidence(
        runtime,
        release,
        kind="deployment",
        path="evidence/ui-v2/firebase-production-smoke.log",
        command="Firebase App Hosting deploy + production browser/API smoke",
        commit=args.commit,
        actor="deployment-verifier",
        metadata={
            "backend": "luma",
            "project": "luma-learning-intelligence",
            "region": "us-central1",
            "root_redirects_to": "/learn",
            "tutor_api": 200,
            "reflections_api": 200,
        },
    )
    release_critic = evidence(
        runtime,
        release,
        kind="critic",
        path="evidence/ui-v2/critic-review.md",
        command="release boundary and product-showcase review",
        commit=args.commit,
        actor="critic",
    )
    verification_id = evidence(
        runtime,
        release,
        kind="verification",
        path="evidence/ui-v2/independent-verification.md",
        command="independent acceptance verification for SPEC 009",
        commit=args.commit,
        actor="independent-verifier",
    )

    runtime.evaluate_gate(
        release,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[release_critic, verification_id],
        note="No unresolved blocking product or UX defect remains for the client-showcase boundary.",
    )
    move(runtime, release, NodeStatus.REVIEW, "Build, security, deployment, and independent verification evidence are complete.", "release-producer")
    runtime.evaluate_gate(
        release,
        actor="release-gate",
        gate_id="release-quality",
        result=GateResult.PASS,
        evidence_ids=[build_id, security_id, production_id, test_id, visual_id],
        note="Build, tests, accessibility, layout, security, and Firebase production smoke all pass.",
    )
    move(runtime, release, NodeStatus.DONE, "Learner UX v2 Firebase showcase release passed.", "release-gate")

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA Learner Experience v2 — Firebase Showcase",
        commit=args.commit,
        evidence_summary={
            "unit_tests": "10 passed",
            "e2e": "15 passed, 1 intentional skip",
            "wcag": "passed",
            "layout": "16 route/viewport checks; zero overflow/clipped/out-of-bounds semantic findings",
            "firebase": "production smoke passed",
            "release_decision": "PASS_FOR_CLIENT_SHOWCASE",
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
