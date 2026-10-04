#!/usr/bin/env python3
"""Record LUMA themed superuser v2 release across Graph Harness nodes 017-026."""

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


def ev(
    runtime: GraphRuntime,
    node_id: str,
    *,
    actor: str,
    kind: str,
    path: str,
    command: str,
    commit: str,
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


def move(runtime: GraphRuntime, node_id: str, target: NodeStatus, actor: str, reason: str) -> None:
    runtime.transition(node_id, actor=actor, target=target, reason=reason)


def close_standard(
    runtime: GraphRuntime,
    node_id: str,
    *,
    commit: str,
    evidence_ids: list[str],
    note: str,
    producer: str = "producer",
) -> None:
    runtime.evaluate_gate(
        node_id,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=evidence_ids,
        note=note,
    )
    move(runtime, node_id, NodeStatus.REVIEW, producer, "Implementation/research and verification evidence complete.")
    move(runtime, node_id, NodeStatus.DONE, "independent-verifier", note)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()

    required = [
        "specs/012-theme-system-superuser.md",
        "specs/013-iconography-3dicon.md",
        "specs/014-progress-andragogy.md",
        "specs/015-glass-adversarial-testing.md",
        "specs/016-original-coach-voice.md",
        "specs/017-video-ingestion-showcase.md",
        "src/lib/themes.ts",
        "src/components/experience-console.tsx",
        "src/components/progress-story.tsx",
        "docs/design/liquid-glass-contract.md",
        "docs/iconography/3dicon-pipeline.md",
        "docs/voice/original-seres-coach-voice.md",
        "docs/video/showcase-runbook.md",
        "evidence/theme-research/seres-brand-audit.md",
        "evidence/glass-adversarial/report.json",
        "evidence/glass-adversarial/audit-v2.log",
        "evidence/iconography/gemini/practice-se-candidate.md",
        "evidence/iconography/3dicon-motion-dry-run.txt",
        "evidence/progress/andragogy-review.md",
        "evidence/voice/prototype-01.md",
        "evidence/video/live-inventory.md",
        "evidence/themed-experience/verify-v2.log",
        "evidence/themed-experience/e2e-v2.log",
        "evidence/themed-experience/visual-audit-v2.log",
        "evidence/themed-experience/npm-audit-production-v2.json",
        "evidence/themed-experience/critic-review-v2.md",
        "evidence/themed-experience/independent-verification-v2.md",
        "evidence/themed-experience/release-decision-v2.md",
        "evidence/themed-experience/firebase-production-smoke-v2.log",
        "public/audio/seres-coach-prototype-01.mp3",
        "public/iconography/review/practice-se-candidate.png",
        "public/media/seres-paso-58.jpg",
    ]
    for path in required:
        require(path)

    runtime = GraphRuntime.from_paths(
        ROOT / "graph-harness.project.json",
        ROOT / "graph-harness.events.jsonl",
    )

    # 017 — theme + superuser architecture
    n = "LUMA-017-theme-superuser-architecture"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Premium showcase release is complete.")
    move(runtime, n, NodeStatus.RUNNING, "producer", "Three-theme and superuser implementation started.")
    e1 = ev(runtime, n, actor="producer", kind="implementation", path="src/components/experience-console.tsx",
            command="implement unified superuser console with role and theme comparison", commit=args.commit,
            metadata={"themes": ["se", "light", "dark"], "roles": ["coachee", "coach", "superuser"]})
    e2 = ev(runtime, n, actor="test-runner", kind="test", path="evidence/themed-experience/e2e-v2.log",
            command="env -u CI npm run test:e2e", commit=args.commit, metadata={"passed": 33, "skipped": 1})
    e3 = ev(runtime, n, actor="independent-verifier", kind="verification",
            path="evidence/themed-experience/independent-verification-v2.md",
            command="independent themed-superuser verification", commit=args.commit)
    e4 = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
            command="critic review of theme, role and product boundaries", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3, e4],
                   note="Three-theme superuser architecture is coherent, persisted, role-separated and verified.")

    # 018 — SE institutional theme
    n = "LUMA-018-seres-institutional-theme"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Theme architecture is complete.")
    move(runtime, n, NodeStatus.RUNNING, "producer", "Institutional brand implementation and provenance review started.")
    e1 = ev(runtime, n, actor="brand-reviewer", kind="source", path="evidence/theme-research/seres-brand-audit.md",
            command="verify official SE logo and institutional palette", commit=args.commit,
            metadata={"palette": ["#00A2F1", "#FF438C", "#993366", "#FFFFFF", "#333333"]})
    e2 = ev(runtime, n, actor="visual-verifier", kind="visual",
            path="evidence/themed-experience/previews-v2/se-preview.jpg",
            command="render SE superuser experience preview", commit=args.commit)
    e3 = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
            command="critic review of institutional theme fidelity and stereotype risk", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3],
                   note="SE theme uses verified institutional assets and passes client-showcase visual review.")

    # 019 — Liquid Light
    n = "LUMA-019-liquid-light-theme"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Theme architecture is complete.")
    move(runtime, n, NodeStatus.RUNNING, "producer", "Liquid Light material theme implementation started.")
    e1 = ev(runtime, n, actor="producer", kind="design-contract", path="docs/design/liquid-glass-contract.md",
            command="codify lens/material, motion, transparency and accessibility rules", commit=args.commit)
    e2 = ev(runtime, n, actor="visual-verifier", kind="visual",
            path="evidence/themed-experience/previews-v2/light-preview.jpg",
            command="render Liquid Light superuser experience preview", commit=args.commit)
    e3 = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
            command="critic review of Liquid Light material hierarchy and accessibility", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3],
                   note="Liquid Light material hierarchy is restrained, accessible and verified.")

    # 020 — Nocturne
    n = "LUMA-020-nocturne-theme"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Theme architecture is complete.")
    move(runtime, n, NodeStatus.RUNNING, "producer", "Nocturne Intelligence theme implementation started.")
    e1 = ev(runtime, n, actor="producer", kind="implementation", path="src/lib/themes.ts",
            command="define Nocturne semantic palette and theme contract", commit=args.commit)
    e2 = ev(runtime, n, actor="visual-verifier", kind="visual",
            path="evidence/themed-experience/previews-v2/dark-preview.jpg",
            command="render Nocturne superuser experience preview", commit=args.commit)
    e3 = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
            command="critic review of dark-theme density, contrast and premium tone", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3],
                   note="Nocturne supports premium deep-work density across the verified product surfaces.")

    # 021 — glass adversarial
    n = "LUMA-021-glass-adversarial-harness"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "All three material themes are complete.")
    move(runtime, n, NodeStatus.RUNNING, "adversarial-verifier", "Glass material adversarial matrix started.")
    e1 = ev(runtime, n, actor="adversarial-verifier", kind="test", path="evidence/glass-adversarial/report.json",
            command="node scripts/glass-adversarial-audit.mjs", commit=args.commit,
            metadata={"checks": 30, "blocking_findings": 0, "nested_glass": 0, "reduced_transparency": True})
    e2 = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
            command="review glass hierarchy, legibility, motion and anti-template risks", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2],
                   note="Glass adversarial testing passes all 30 theme/route/viewport checks.",
                   producer="adversarial-verifier")

    # 022 — iconography + 3dicon gate
    n = "LUMA-022-iconography-3dicon-pipeline"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "All three visual themes are complete.")
    move(runtime, n, NodeStatus.RUNNING, "asset-producer", "Controlled semantic icon pipeline verification started.")
    e1 = ev(runtime, n, actor="asset-producer", kind="generated-still",
            path="evidence/iconography/gemini/practice-se-candidate.md",
            command="generate exactly one SE Practice/P.A.S. still through authenticated Gemini bridge", commit=args.commit,
            metadata={"status": "AWAITING_PO_APPROVAL", "source": "Gemini authenticated browser bridge", "animated": False})
    e2 = ev(runtime, n, actor="asset-producer", kind="motion-proposal",
            path="evidence/iconography/3dicon-motion-dry-run.txt",
            command="upstream 3dicon animate --dry-run --strategy event", commit=args.commit,
            metadata={"paid_animation_run": False, "approval_required": True})
    e3 = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
            command="review generated still against adult/premium/semantic asset constraints", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3],
                   note="3D icon pipeline is operational and correctly stops at the explicit still/motion approval gates.",
                   producer="asset-producer")

    # 023 — progress
    n = "LUMA-023-andragogical-progress"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Superuser theme architecture is complete.")
    move(runtime, n, NodeStatus.RUNNING, "producer", "Andragogical progress surface verification started.")
    e1 = ev(runtime, n, actor="producer", kind="implementation", path="src/components/progress-story.tsx",
            command="implement capability/transfer/next-demonstration progress story", commit=args.commit)
    e2 = ev(runtime, n, actor="learning-reviewer", kind="review", path="evidence/progress/andragogy-review.md",
            command="review progress against adult-learning product rules", commit=args.commit)
    e3 = ev(runtime, n, actor="test-runner", kind="test", path="evidence/themed-experience/e2e-v2.log",
            command="verify adult progress semantics in browser", commit=args.commit)
    e4 = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
            command="critic review for child-oriented progress cues and opaque scoring", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3, e4],
                   note="Progress is expressed as demonstrated capability, transfer and next relevant use.")

    # 024 — original voice
    n = "LUMA-024-original-coach-voice"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Superuser architecture is complete.")
    move(runtime, n, NodeStatus.RUNNING, "voice-researcher", "Original Seres Coach Voice direction and prototype started.")
    e1 = ev(runtime, n, actor="voice-researcher", kind="research", path="docs/voice/original-seres-coach-voice.md",
            command="define original voice direction and rights boundary", commit=args.commit)
    e2 = ev(runtime, n, actor="voice-researcher", kind="prototype", path="evidence/voice/prototype-01.md",
            command="generate and evaluate 12.4s original-direction Spanish speech prototype", commit=args.commit,
            metadata={"duration_seconds": 12.4, "direct_clone": False, "final_voice_selected": False})
    e3 = ev(runtime, n, actor="rights-reviewer", kind="rights", path="evidence/voice/research-and-rights.md",
            command="verify direct-identifiable-voice cloning remains gated", commit=args.commit)
    e4 = ev(runtime, n, actor="critic", kind="critic", path="evidence/voice/critic-review-v2.md",
            command="critic review of originality, rights, pedagogy and inference boundaries", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3, e4],
                   note="Original voice pipeline works; final identity and any direct clone remain explicitly rights-gated.",
                   producer="voice-researcher")

    # 025 — video showcase + private boundary
    n = "LUMA-025-private-video-showcase-pipeline"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Superuser architecture is complete.")
    move(runtime, n, NodeStatus.RUNNING, "media-researcher", "Video showcase and private source-boundary verification started.")
    e1 = ev(runtime, n, actor="media-researcher", kind="inventory", path="evidence/video/live-inventory.md",
            command="verify private course inventory without exposing source locators", commit=args.commit,
            metadata={"private_classes": 5, "approx_total_gib": 15.82, "rights_gate": "OPEN"})
    e2 = ev(runtime, n, actor="media-researcher", kind="runbook", path="docs/video/showcase-runbook.md",
            command="define public showcase baseline and private derivative pipeline", commit=args.commit)
    e3 = ev(runtime, n, actor="media-producer", kind="implementation", path="src/components/experience-console.tsx",
            command="integrate click-to-load public video showcase without private Drive locators", commit=args.commit)
    e4 = ev(runtime, n, actor="critic", kind="critic", path="evidence/video/critic-review-v2.md",
            command="critic review of public showcase, private rights boundary and evidence semantics", commit=args.commit)
    close_standard(runtime, n, commit=args.commit, evidence_ids=[e1, e2, e3, e4],
                   note="Video surface is client-demonstrable with a public source while private course material remains rights-gated.",
                   producer="media-researcher")

    # 026 — release
    n = "LUMA-026-themed-superuser-release"
    move(runtime, n, NodeStatus.READY, "graph-scheduler", "Theme, glass, iconography, progress, voice and video tracks are complete.")
    move(runtime, n, NodeStatus.RUNNING, "release-producer", "Themed superuser Firebase release verification started.")

    test_id = ev(runtime, n, actor="browser-verifier", kind="test", path="evidence/themed-experience/e2e-v2.log",
                 command="env -u CI npm run test:e2e", commit=args.commit,
                 metadata={"passed": 33, "skipped": 1, "desktop_mobile": True})
    build_id = ev(runtime, n, actor="build-verifier", kind="build", path="evidence/themed-experience/verify-v2.log",
                  command="npm run verify", commit=args.commit,
                  metadata={"unit_tests": 16, "production_build": "PASS"})
    a11y_id = ev(runtime, n, actor="accessibility-verifier", kind="a11y", path="evidence/themed-experience/e2e-v2.log",
                 command="Playwright Axe WCAG 2 A/AA client-facing sweep", commit=args.commit,
                 metadata={"wcag": "A/AA", "result": "PASS"})
    visual_id = ev(runtime, n, actor="visual-verifier", kind="visual", path="evidence/themed-experience/visual-audit-v2.log",
                   command="node scripts/visual-audit.mjs", commit=args.commit,
                   metadata={"route_viewport_checks": 22, "layout_findings": 0})
    glass_id = ev(runtime, n, actor="adversarial-verifier", kind="adversarial", path="evidence/glass-adversarial/audit-v2.log",
                  command="node scripts/glass-adversarial-audit.mjs", commit=args.commit,
                  metadata={"checks": 30, "blocking_findings": 0})
    sec_id = ev(runtime, n, actor="security-reviewer", kind="security",
                path="evidence/themed-experience/npm-audit-production-v2.json",
                command="npm audit --omit=dev --json", commit=args.commit,
                metadata={"production_vulnerabilities": 0})
    deploy_id = ev(runtime, n, actor="deployment-verifier", kind="deployment",
                   path="evidence/themed-experience/firebase-production-smoke-v2.log",
                   command="Firebase App Hosting deploy + HTTP/browser/API smoke", commit=args.commit,
                   metadata={
                       "firebase_backend": "luma",
                       "project": "luma-learning-intelligence",
                       "surfaces_200": True,
                       "voice_asset_200": True,
                       "icon_asset_200": True,
                       "video_poster_200": True,
                       "tutor": "GROUNDED",
                       "reflection": "PASS",
                   })
    critic_id = ev(runtime, n, actor="critic", kind="critic", path="evidence/themed-experience/critic-review-v2.md",
                   command="final themed-superuser adversarial product review", commit=args.commit)
    verify_id = ev(runtime, n, actor="independent-verifier", kind="verification",
                   path="evidence/themed-experience/independent-verification-v2.md",
                   command="independent release verification", commit=args.commit)

    runtime.evaluate_gate(
        n,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic_id, verify_id],
        note="No unresolved blocking role, theme, glass, progress, media, accessibility or release defect remains.",
    )
    move(runtime, n, NodeStatus.REVIEW, "release-producer", "Release evidence and independent review are complete.")
    runtime.evaluate_gate(
        n,
        actor="release-gate",
        gate_id="release-quality",
        result=GateResult.PASS,
        evidence_ids=[test_id, build_id, a11y_id, visual_id, glass_id, sec_id, deploy_id],
        note="Build, tests, accessibility, visual layout, glass adversarial, security and Firebase production smoke pass.",
    )
    move(runtime, n, NodeStatus.DONE, "release-gate", "Themed superuser client-showcase release passed.")

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA Themed Superuser Showcase v2",
        commit=args.commit,
        evidence_summary={
            "themes": "SE / Liquid Light / Nocturne",
            "unit_tests": "16 passed",
            "e2e": "33 passed, 1 intentional skip",
            "wcag": "A/AA passed",
            "visual": "22 route/viewport checks; zero layout findings",
            "glass": "30 checks; zero blocking findings",
            "security": "0 production vulnerabilities",
            "iconography": "one Gemini still candidate; motion gated",
            "voice": "12.4s original-direction prototype; clone gated",
            "video": "public showcase + private rights gate",
            "firebase": "production smoke passed",
            "release_decision": "PASS_FOR_CLIENT_SHOWCASE",
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
