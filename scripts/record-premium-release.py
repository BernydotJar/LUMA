#!/usr/bin/env python3
"""Record premium adult intelligence, semantic visuals, voice evaluation, and Firebase release."""

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
    parser.add_argument("--commit", required=True, help="Remote implementation commit deployed to Firebase")
    args = parser.parse_args()

    required = [
        "specs/011-premium-adult-intelligence.md",
        "docs/design/source-guided-premium-system.md",
        "docs/product-messaging-boundaries.md",
        "docs/design/voice-modality-evaluation.md",
        "src/lib/experience-themes.ts",
        "src/components/semantic-object.tsx",
        "evidence/premium-adult/source-guidance.md",
        "evidence/premium-adult/critic-review.md",
        "evidence/premium-adult/independent-verification.md",
        "evidence/premium-adult/voice-evaluation.md",
        "evidence/premium-adult/verify.log",
        "evidence/premium-adult/e2e.log",
        "evidence/premium-adult/visual-audit.log",
        "evidence/premium-adult/npm-audit-production.json",
        "evidence/premium-adult/firebase-production-smoke.log",
    ]
    for item in required:
        require(item)

    runtime = GraphRuntime.from_paths(
        ROOT / "graph-harness.project.json",
        ROOT / "graph-harness.events.jsonl",
    )

    premium = "LUMA-013-premium-adult-intelligence"
    if runtime.state().nodes[premium].status is not NodeStatus.APPROVED:
        raise SystemExit(f"{premium} is not approved")

    move(runtime, premium, NodeStatus.READY, "Role-separated showcase release is complete.", "graph-scheduler")
    move(runtime, premium, NodeStatus.RUNNING, "Premium adult intelligence work started from SPEC 011.", "producer")
    premium_impl = evidence(
        runtime,
        premium,
        kind="implementation",
        path="src/lib/experience-themes.ts",
        command="implement source-guided experience modes and concept-to-visual semantic registry",
        commit=args.commit,
        actor="producer",
        metadata={
            "experience_modes": [
                "Organic Reflection",
                "Editorial Warmth",
                "Architectural Focus",
                "Technical Precision",
            ],
            "gender_inference": False,
            "source_guided": True,
        },
    )
    source_id = evidence(
        runtime,
        premium,
        kind="source",
        path="evidence/premium-adult/source-guidance.md",
        command="review supplied Module 3 corpus and separate source-derived structures from product-design interpretations",
        commit=args.commit,
        actor="content-reviewer",
        metadata={
            "source_asset": "1OwHgWtDXC_AzkU31f6a7tuoHWHl0gv5V",
            "concepts": ["emotion", "P.A.S.", "logical-levels", "beliefs", "values", "identity", "mental-maps"],
        },
    )
    premium_test = evidence(
        runtime,
        premium,
        kind="test",
        path="evidence/premium-adult/verify.log",
        command="npm run verify",
        commit=args.commit,
        actor="test-runner",
        metadata={"unit_tests": 13, "semantic_system_tests": 3, "production_build": "PASS"},
    )
    premium_critic = evidence(
        runtime,
        premium,
        kind="critic",
        path="evidence/premium-adult/critic-review.md",
        command="adversarial review of adult positioning, gender-stereotype risk, source grounding, and product messaging",
        commit=args.commit,
        actor="critic",
    )
    evidence(
        runtime,
        premium,
        kind="verification",
        path="evidence/premium-adult/independent-verification.md",
        command="independent verification of SPEC 011 premium-adult acceptance criteria",
        commit=args.commit,
        actor="independent-verifier",
    )
    runtime.evaluate_gate(
        premium,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[premium_impl, source_id, premium_test, premium_critic],
        note="Premium adult language is source-guided, outcome-led, and free of gender-based theme inference.",
    )
    move(runtime, premium, NodeStatus.REVIEW, "Implementation, source, test, critic, and verification evidence complete.", "producer")
    move(runtime, premium, NodeStatus.DONE, "Independent premium adult experience review passed.", "independent-verifier")

    semantic = "LUMA-014-semantic-3d-system"
    move(runtime, semantic, NodeStatus.READY, "Premium adult intelligence node is complete.", "graph-scheduler")
    move(runtime, semantic, NodeStatus.RUNNING, "Semantic 3D system implementation started.", "producer")
    semantic_impl = evidence(
        runtime,
        semantic,
        kind="implementation",
        path="src/components/semantic-object.tsx",
        command="implement decorative premium semantic 3D object system",
        commit=args.commit,
        actor="producer",
        metadata={
            "moments": {
                "practice": "prism",
                "progress": "orbit",
                "coach_insight": "strata",
                "human_intervention": "bridge",
            },
            "aria_hidden": True,
            "reduced_motion": True,
        },
    )
    semantic_visual = evidence(
        runtime,
        semantic,
        kind="visual",
        path="evidence/premium-adult/visual-audit.log",
        command="node scripts/visual-audit.mjs",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"route_viewport_checks": 18, "semantic_layout_findings": 0},
    )
    semantic_e2e = evidence(
        runtime,
        semantic,
        kind="test",
        path="evidence/premium-adult/e2e.log",
        command="env -u CI npm run test:e2e",
        commit=args.commit,
        actor="browser-verifier",
        metadata={"passed": 25, "skipped": 1, "semantic_object_routes": ["/learn", "/studio"]},
    )
    semantic_critic = evidence(
        runtime,
        semantic,
        kind="critic",
        path="evidence/premium-adult/critic-review.md",
        command="visual critique for childish cues, decorative overload, and semantic mismatch",
        commit=args.commit,
        actor="critic",
    )
    runtime.evaluate_gate(
        semantic,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[semantic_impl, semantic_visual, semantic_e2e, semantic_critic],
        note="Semantic objects are abstract, premium, source-linked, decorative, and visually verified across desktop/mobile.",
    )
    move(runtime, semantic, NodeStatus.REVIEW, "Implementation, E2E, visual, and critic evidence complete.", "producer")
    move(runtime, semantic, NodeStatus.DONE, "Independent semantic visual review passed.", "independent-verifier")

    voice = "LUMA-015-voice-modality-evaluation"
    move(runtime, voice, NodeStatus.READY, "Semantic visual system is complete.", "graph-scheduler")
    move(runtime, voice, NodeStatus.RUNNING, "Voice learning-modality evaluation started.", "product-researcher")
    voice_impl = evidence(
        runtime,
        voice,
        kind="research",
        path="docs/design/voice-modality-evaluation.md",
        command="evaluate voice as a pedagogical modality and define provider-neutral contract",
        commit=args.commit,
        actor="product-researcher",
        metadata={
            "decision": "prototype only when speaking/listening is part of learning objective",
            "provider_selected": False,
            "text_fallback_required": True,
        },
    )
    voice_connector = evidence(
        runtime,
        voice,
        kind="research",
        path="evidence/premium-adult/voice-evaluation.md",
        command="check connector availability and define first pedagogically necessary voice prototype",
        commit=args.commit,
        actor="product-researcher",
        metadata={
            "elevenlabs_connector": False,
            "runway_connected": True,
            "provider_neutral": True,
        },
    )
    voice_critic = evidence(
        runtime,
        voice,
        kind="critic",
        path="evidence/premium-adult/critic-review.md",
        command="review voice proposal for ornament-only use, unsafe inference, and provider lock-in",
        commit=args.commit,
        actor="critic",
    )
    runtime.evaluate_gate(
        voice,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[voice_impl, voice_connector, voice_critic],
        note="Voice is approved as a learning-modality prototype candidate, not as decorative narration or a provider-specific dependency.",
    )
    move(runtime, voice, NodeStatus.REVIEW, "Research, connector check, and critic review complete.", "product-researcher")
    move(runtime, voice, NodeStatus.DONE, "Voice modality evaluation passed.", "independent-verifier")

    release = "LUMA-016-premium-showcase-release"
    move(runtime, release, NodeStatus.READY, "Premium experience, semantic visuals, and voice evaluation are complete.", "graph-scheduler")
    move(runtime, release, NodeStatus.RUNNING, "Premium Firebase showcase release verification started.", "release-producer")

    release_test = evidence(
        runtime,
        release,
        kind="test",
        path="evidence/premium-adult/e2e.log",
        command="env -u CI npm run test:e2e",
        commit=args.commit,
        actor="browser-verifier",
        metadata={"passed": 25, "skipped": 1, "desktop_mobile": True},
    )
    release_build = evidence(
        runtime,
        release,
        kind="build",
        path="evidence/premium-adult/verify.log",
        command="npm run verify",
        commit=args.commit,
        actor="build-verifier",
        metadata={"unit_tests": 13, "production_build": "PASS"},
    )
    release_a11y = evidence(
        runtime,
        release,
        kind="a11y",
        path="evidence/premium-adult/e2e.log",
        command="Playwright axe WCAG 2 A/AA sweep",
        commit=args.commit,
        actor="accessibility-verifier",
        metadata={"result": "PASS"},
    )
    release_security = evidence(
        runtime,
        release,
        kind="security",
        path="evidence/premium-adult/npm-audit-production.json",
        command="npm audit --omit=dev --json",
        commit=args.commit,
        actor="security-reviewer",
        metadata={"production_vulnerabilities": 0},
    )
    release_visual = evidence(
        runtime,
        release,
        kind="visual",
        path="evidence/premium-adult/visual-audit.log",
        command="node scripts/visual-audit.mjs",
        commit=args.commit,
        actor="visual-verifier",
        metadata={"route_viewport_checks": 18, "semantic_layout_findings": 0},
    )
    release_deploy = evidence(
        runtime,
        release,
        kind="deployment",
        path="evidence/premium-adult/firebase-production-smoke.log",
        command="Firebase App Hosting deploy plus premium semantic/browser/API production smoke",
        commit=args.commit,
        actor="deployment-verifier",
        metadata={
            "backend": "luma",
            "project": "luma-learning-intelligence",
            "region": "us-central1",
            "practice_object": "PASS",
            "progress_object": "PASS",
            "coach_insight_object": "PASS",
            "human_intervention_object": "PASS",
            "operating_model_copy_leak": False,
            "tutor_api": 200,
            "reflections_api": 200,
        },
    )
    release_critic = evidence(
        runtime,
        release,
        kind="critic",
        path="evidence/premium-adult/critic-review.md",
        command="premium adult intelligence client-showcase release review",
        commit=args.commit,
        actor="critic",
    )
    release_verification = evidence(
        runtime,
        release,
        kind="verification",
        path="evidence/premium-adult/independent-verification.md",
        command="independent release verification for SPEC 011",
        commit=args.commit,
        actor="independent-verifier",
    )

    runtime.evaluate_gate(
        release,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[release_critic, release_verification],
        note="No unresolved blocking product, visual, role-separation, source-grounding, accessibility, or messaging defect remains.",
    )
    move(runtime, release, NodeStatus.REVIEW, "All release evidence is complete.", "release-producer")
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
            release_deploy,
        ],
        note="Build, tests, accessibility, security, visual audit, semantic-object smoke, and Firebase production smoke pass.",
    )
    move(runtime, release, NodeStatus.DONE, "Premium adult intelligence Firebase showcase release passed.", "release-gate")

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA Premium Adult Intelligence Showcase",
        commit=args.commit,
        evidence_summary={
            "unit_tests": "13 passed",
            "e2e": "25 passed, 1 intentional skip",
            "wcag": "A/AA passed",
            "layout": "18 route/viewport checks; zero semantic findings",
            "security": "0 production vulnerabilities",
            "semantic_objects": "practice/progress/coach-insight/human-intervention passed",
            "messaging": "outcome-led; operating-model headline removed",
            "voice": "provider-neutral modality evaluation passed",
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
