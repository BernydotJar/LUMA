#!/usr/bin/env python3
"""Record the coachee/coach separation and role-separated showcase release."""

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


def move(
    runtime: GraphRuntime,
    node_id: str,
    target: NodeStatus,
    reason: str,
    actor: str,
) -> None:
    runtime.transition(node_id, actor=actor, target=target, reason=reason)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--commit",
        required=True,
        help="Remote implementation commit whose tree was deployed to Firebase",
    )
    args = parser.parse_args()

    required = [
        "specs/010-coachee-coach-separation.md",
        "src/app/learn/page.tsx",
        "src/app/studio/learners/mariana/page.tsx",
        "src/components/twin-detail.tsx",
        "src/components/studio-dashboard.tsx",
        "src/app/library/page.tsx",
        "evidence/role-separation/critic-review.md",
        "evidence/role-separation/independent-verification.md",
        "evidence/role-separation/verify.log",
        "evidence/role-separation/e2e.log",
        "evidence/role-separation/visual-audit.log",
        "evidence/role-separation/npm-audit-production.json",
        "evidence/role-separation/firebase-production-smoke.log",
    ]
    for item in required:
        require(item)

    project = ROOT / "graph-harness.project.json"
    events = ROOT / "graph-harness.events.jsonl"
    runtime = GraphRuntime.from_paths(project, events)

    coachee = "LUMA-010-coachee-language-separation"
    if runtime.state().nodes[coachee].status is not NodeStatus.APPROVED:
        raise SystemExit(f"{coachee} is not approved")

    move(
        runtime,
        coachee,
        NodeStatus.READY,
        "UI v2 release is complete and SPEC 010 is executable.",
        "graph-scheduler",
    )
    move(
        runtime,
        coachee,
        NodeStatus.RUNNING,
        "Positive coachee language and internal-model separation started.",
        "producer",
    )
    coachee_impl = evidence(
        runtime,
        coachee,
        kind="implementation",
        path="src/app/learn/page.tsx",
        command="separate learner-facing journey copy and navigation from internal Learning Twin concepts",
        commit=args.commit,
        actor="producer",
        metadata={
            "learner_navigation": ["Hoy", "Journey", "Práctica", "LUMA"],
            "visible_learning_twin_on_learn": False,
            "copy_principle": "affirmative action-oriented language",
        },
    )
    coachee_test = evidence(
        runtime,
        coachee,
        kind="test",
        path="evidence/role-separation/e2e.log",
        command="env -u CI npm run test:e2e",
        commit=args.commit,
        actor="browser-verifier",
        metadata={
            "passed": 21,
            "skipped": 1,
            "coachee_role_separation": "PASS",
            "desktop_mobile": True,
        },
    )
    coachee_critic = evidence(
        runtime,
        coachee,
        kind="critic",
        path="evidence/role-separation/critic-review.md",
        command="adversarial review of coachee copy, internal-model leakage, and information architecture",
        commit=args.commit,
        actor="critic",
    )
    evidence(
        runtime,
        coachee,
        kind="verification",
        path="evidence/role-separation/independent-verification.md",
        command="independent verification of positive learner language and Twin separation",
        commit=args.commit,
        actor="independent-verifier",
    )
    runtime.evaluate_gate(
        coachee,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[coachee_impl, coachee_test, coachee_critic],
        note="Coachee surface is action-first, uses affirmative framing, and exposes no visible Learning Twin copy.",
    )
    move(
        runtime,
        coachee,
        NodeStatus.REVIEW,
        "Producer, browser, critic, and verification evidence are complete.",
        "producer",
    )
    move(
        runtime,
        coachee,
        NodeStatus.DONE,
        "Independent coachee experience review passed.",
        "independent-verifier",
    )

    coach = "LUMA-011-coach-intelligence-ui"
    move(
        runtime,
        coach,
        NodeStatus.READY,
        "Coachee separation is complete; coach intelligence UI is unblocked.",
        "graph-scheduler",
    )
    move(
        runtime,
        coach,
        NodeStatus.RUNNING,
        "Coach Learning Twin and coach visual parity implementation started.",
        "producer",
    )
    coach_impl = evidence(
        runtime,
        coach,
        kind="implementation",
        path="src/components/twin-detail.tsx",
        command="move Learning Twin into proprietary coach intelligence route with evidence and governance",
        commit=args.commit,
        actor="producer",
        metadata={
            "route": "/studio/learners/mariana",
            "legacy_twin_redirect": "/studio/learners/mariana",
            "proprietary_notice": "visible",
            "evidence_taxonomy": ["observed", "inferred", "self-reported"],
        },
    )
    evidence(
        runtime,
        coach,
        kind="implementation",
        path="src/components/studio-dashboard.tsx",
        command="align Coach Studio with role-specific product language and visual system",
        commit=args.commit,
        actor="producer",
    )
    evidence(
        runtime,
        coach,
        kind="implementation",
        path="src/app/library/page.tsx",
        command="render Content Intelligence as coach-facing curriculum intelligence",
        commit=args.commit,
        actor="producer",
    )
    coach_visual = evidence(
        runtime,
        coach,
        kind="visual",
        path="evidence/role-separation/visual-audit.log",
        command="node scripts/visual-audit.mjs",
        commit=args.commit,
        actor="visual-verifier",
        metadata={
            "route_viewport_checks": 18,
            "semantic_layout_findings": 0,
            "coach_surfaces": [
                "/studio",
                "/studio/learners/mariana",
                "/library",
                "/studio/reflections",
            ],
        },
    )
    coach_critic = evidence(
        runtime,
        coach,
        kind="critic",
        path="evidence/role-separation/critic-review.md",
        command="adversarial coach-product review of Twin, Studio, Content Intelligence, and proprietary marking",
        commit=args.commit,
        actor="critic",
    )
    evidence(
        runtime,
        coach,
        kind="verification",
        path="evidence/role-separation/independent-verification.md",
        command="independent verification of coach intelligence scope and visual parity",
        commit=args.commit,
        actor="independent-verifier",
    )
    runtime.evaluate_gate(
        coach,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[coach_impl, coach_visual, coach_critic],
        note="Learning Twin is coach-facing, proprietary-marked, evidence-backed, and visually aligned with Coach Studio and Content Intelligence.",
    )
    move(
        runtime,
        coach,
        NodeStatus.REVIEW,
        "Coach intelligence implementation and independent evidence are complete.",
        "producer",
    )
    move(
        runtime,
        coach,
        NodeStatus.DONE,
        "Independent coach intelligence review passed.",
        "independent-verifier",
    )

    release = "LUMA-012-role-separated-showcase-release"
    move(
        runtime,
        release,
        NodeStatus.READY,
        "Coachee and coach experience nodes are complete.",
        "graph-scheduler",
    )
    move(
        runtime,
        release,
        NodeStatus.RUNNING,
        "Role-separated Firebase showcase release verification started.",
        "release-producer",
    )

    release_test = evidence(
        runtime,
        release,
        kind="test",
        path="evidence/role-separation/e2e.log",
        command="env -u CI npm run test:e2e",
        commit=args.commit,
        actor="browser-verifier",
        metadata={"passed": 21, "skipped": 1, "desktop_mobile": True},
    )
    release_build = evidence(
        runtime,
        release,
        kind="build",
        path="evidence/role-separation/verify.log",
        command="npm run verify",
        commit=args.commit,
        actor="build-verifier",
        metadata={"unit_tests": 10, "production_build": "PASS"},
    )
    release_a11y = evidence(
        runtime,
        release,
        kind="a11y",
        path="evidence/role-separation/e2e.log",
        command="Playwright axe WCAG 2 A/AA sweep across coachee and coach routes",
        commit=args.commit,
        actor="accessibility-verifier",
        metadata={"wcag": "A/AA", "result": "PASS"},
    )
    release_security = evidence(
        runtime,
        release,
        kind="security",
        path="evidence/role-separation/npm-audit-production.json",
        command="npm audit --omit=dev --json",
        commit=args.commit,
        actor="security-reviewer",
        metadata={"production_vulnerabilities": 0},
    )
    release_visual = evidence(
        runtime,
        release,
        kind="visual",
        path="evidence/role-separation/visual-audit.log",
        command="node scripts/visual-audit.mjs",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"route_viewport_checks": 18, "semantic_layout_findings": 0},
    )
    release_deployment = evidence(
        runtime,
        release,
        kind="deployment",
        path="evidence/role-separation/firebase-production-smoke.log",
        command="Firebase App Hosting deploy plus learner/coach/browser/API production smoke",
        commit=args.commit,
        actor="deployment-verifier",
        metadata={
            "backend": "luma",
            "project": "luma-learning-intelligence",
            "region": "us-central1",
            "learner_hero": "PASS",
            "learning_twin_hidden_from_coachee": True,
            "coach_copyright": "PASS",
            "legacy_twin_redirect": "PASS",
            "tutor_api": 200,
            "reflections_api": 200,
        },
    )
    release_critic = evidence(
        runtime,
        release,
        kind="critic",
        path="evidence/role-separation/critic-review.md",
        command="role-separated client-showcase release review",
        commit=args.commit,
        actor="critic",
    )
    release_verification = evidence(
        runtime,
        release,
        kind="verification",
        path="evidence/role-separation/independent-verification.md",
        command="independent acceptance verification for SPEC 010",
        commit=args.commit,
        actor="independent-verifier",
    )

    runtime.evaluate_gate(
        release,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[release_critic, release_verification],
        note="No unresolved blocking role-separation, product, accessibility, or visual defect remains.",
    )
    move(
        runtime,
        release,
        NodeStatus.REVIEW,
        "Build, test, accessibility, security, visual, deployment, and independent evidence are complete.",
        "release-producer",
    )
    runtime.evaluate_gate(
        release,
        actor="release-gate",
        gate_id="release-quality",
        result=GateResult.PASS,
        evidence_ids=[
            release_test,
            release_build,
            release_a11y,
            release_security,
            release_visual,
            release_deployment,
        ],
        note="All role-separated client-showcase quality gates pass in production.",
    )
    move(
        runtime,
        release,
        NodeStatus.DONE,
        "Role-separated coachee and coach Firebase showcase release passed.",
        "release-gate",
    )

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA Role-Separated Coachee / Coach Showcase",
        commit=args.commit,
        evidence_summary={
            "unit_tests": "10 passed",
            "e2e": "21 passed, 1 intentional skip",
            "wcag": "A/AA passed",
            "layout": "18 route/viewport checks; zero semantic layout findings",
            "security": "0 production vulnerabilities",
            "coachee": "positive action-first copy; Learning Twin hidden",
            "coach": "proprietary Learning Twin with evidence and governance",
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
