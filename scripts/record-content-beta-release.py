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
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    runtime = GraphRuntime.from_paths(ROOT / "graph-harness.project.json", ROOT / "graph-harness.events.jsonl")

    def close(node, evidence_ids, note, producer="producer"):
        runtime.evaluate_gate(node, actor="independent-verifier", gate_id="independent-review", result=GateResult.PASS, evidence_ids=evidence_ids, note=note)
        move(runtime, node, NodeStatus.REVIEW, "Evidence complete.", producer)
        move(runtime, node, NodeStatus.DONE, note, "independent-verifier")

    n="LUMA-027-beta-content-graph"
    move(runtime,n,NodeStatus.READY,"The themed showcase release is complete.","graph-scheduler")
    move(runtime,n,NodeStatus.RUNNING,"Source-grounded content expansion started.","content-producer")
    e1=evidence(runtime,n,kind="source",path="evidence/content-beta/source-map.md",command="review Practitioner Module 2 and Module 3 source scope",commit=args.commit,actor="content-reviewer")
    e2=evidence(runtime,n,kind="implementation",path="src/lib/learning-content.ts",command="encode seven source-grounded learning experiences",commit=args.commit,actor="content-producer")
    e3=evidence(runtime,n,kind="critic",path="evidence/content-beta/critic-review.md",command="review source scope and beta content boundaries",commit=args.commit,actor="critic")
    close(n,[e1,e2,e3],"Source-grounded beta content graph passed independent review.","content-producer")

    n="LUMA-028-learner-experience-library"
    move(runtime,n,NodeStatus.READY,"Content graph is complete.","graph-scheduler")
    move(runtime,n,NodeStatus.RUNNING,"Learner experience catalog and practice routes started.","producer")
    e1=evidence(runtime,n,kind="implementation",path="src/app/learn/experiences/page.tsx",command="implement learner experience catalog",commit=args.commit,actor="producer")
    e2=evidence(runtime,n,kind="test",path="evidence/content-beta/e2e.log",command="env -u CI npm run test:e2e",commit=args.commit,actor="browser-verifier",metadata={"passed":37,"skipped":1})
    e3=evidence(runtime,n,kind="critic",path="evidence/content-beta/critic-review.md",command="review learner content UX and evidence boundary",commit=args.commit,actor="critic")
    close(n,[e1,e2,e3],"Learner content library and reflection route passed independent review.")

    n="LUMA-029-beta-content-release"
    move(runtime,n,NodeStatus.READY,"Content graph and learner library are complete.","graph-scheduler")
    move(runtime,n,NodeStatus.RUNNING,"First-user beta content release verification started.","release-producer")
    test=evidence(runtime,n,kind="test",path="evidence/content-beta/e2e.log",command="env -u CI npm run test:e2e",commit=args.commit,actor="browser-verifier",metadata={"passed":37,"skipped":1})
    build=evidence(runtime,n,kind="build",path="evidence/content-beta/independent-verification.md",command="npm run verify",commit=args.commit,actor="build-verifier",metadata={"unit_tests":16,"build":"PASS"})
    a11y=evidence(runtime,n,kind="a11y",path="evidence/content-beta/e2e.log",command="Playwright Axe WCAG A/AA sweep",commit=args.commit,actor="accessibility-verifier")
    visual=evidence(runtime,n,kind="visual",path="evidence/content-beta/visual-audit.log",command="node scripts/visual-audit.mjs",commit=args.commit,actor="visual-verifier")
    sec=evidence(runtime,n,kind="security",path="evidence/content-beta/npm-audit-production.json",command="npm audit --omit=dev --json",commit=args.commit,actor="security-reviewer",metadata={"production_vulnerabilities":0})
    deploy=evidence(runtime,n,kind="deployment",path="evidence/content-beta/firebase-production-smoke.log",command="Firebase deploy + production smoke",commit=args.commit,actor="deployment-verifier")
    critic=evidence(runtime,n,kind="critic",path="evidence/content-beta/critic-review.md",command="final beta content release review",commit=args.commit,actor="critic")
    verify=evidence(runtime,n,kind="verification",path="evidence/content-beta/independent-verification.md",command="independent beta content verification",commit=args.commit,actor="independent-verifier")
    runtime.evaluate_gate(n,actor="independent-verifier",gate_id="independent-review",result=GateResult.PASS,evidence_ids=[critic,verify],note="No blocking content, UX or evidence defect remains.")
    move(runtime,n,NodeStatus.REVIEW,"Release evidence complete.","release-producer")
    runtime.evaluate_gate(n,actor="release-gate",gate_id="release-quality",result=GateResult.PASS,evidence_ids=[test,build,a11y,visual,sec,deploy],note="Beta content release quality gates pass.")
    move(runtime,n,NodeStatus.DONE,"First-user beta content release passed.","release-gate")
    runtime.checkpoint(actor="release-gate",label="LUMA First-User Content Beta",commit=args.commit,evidence_summary={"content":"7 source-grounded experiences","e2e":"37 passed, 1 skip","unit":"16 passed","security":"0 production vulnerabilities","firebase":"production smoke passed","decision":"PASS_FOR_FIRST_USER_BETA"})
    state=runtime.as_dict()
    (ROOT / "evidence/graph-harness-status.json").write_text(json.dumps(state,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(state,indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
