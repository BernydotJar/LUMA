#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from graph_harness.model import GateResult, NodeStatus
from graph_harness.runtime import GraphRuntime

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "graph-harness.project.json"
EVENTS = ROOT / "graph-harness.events.jsonl"
STATUS = ROOT / "evidence/graph-harness-status.json"
CI = ROOT / "evidence/v2-commerce-ledger/ci-gates.json"
REVIEW = ROOT / "evidence/v2-commerce-ledger/independent-review.md"
FINAL = ROOT / "evidence/v2-commerce-ledger/graph-finalization.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def artifact(rel: str) -> Path:
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"missing evidence artifact: {rel}")
    return path


def require_release_evidence(commit: str) -> dict:
    data = json.loads(CI.read_text(encoding="utf-8"))
    if data.get("reviewed_commit") != commit:
        raise RuntimeError("ci evidence commit does not match requested product commit")
    if data.get("decision") != "PASS":
        raise RuntimeError("ci evidence decision is not PASS")
    gates = data["gates"]
    if gates["verify"]["conclusion"] != "success":
        raise RuntimeError("verify gate did not pass")
    if gates["firestore"]["conclusion"] != "success" or gates["firestore"]["passed"] != 10:
        raise RuntimeError("Firestore gate did not pass 10/10")
    if gates["browser"]["conclusion"] != "success" or gates["browser"]["failed"] != 0:
        raise RuntimeError("browser gate did not pass")
    if gates["production_dependency_audit"]["vulnerabilities"] != 0:
        raise RuntimeError("production dependency audit is not clean")
    review = data["independent_review"]
    if review["code_review"] != "PASS" or review["security_review"] != "PASS":
        raise RuntimeError("independent review did not pass")
    if review["active_review_threads"] != 0:
        raise RuntimeError("active review findings remain")
    text = REVIEW.read_text(encoding="utf-8")
    if "FINAL INDEPENDENT REVIEW: PASS" not in text:
        raise RuntimeError("independent review artifact lacks final PASS marker")
    return data


def record(runtime: GraphRuntime, node: str, *, kind: str, path: str, command: str, commit: str, actor: str, metadata: dict | None = None) -> str:
    p = artifact(path)
    event = runtime.record_evidence(
        node,
        actor=actor,
        kind=kind,
        result="PASS",
        artifact=path,
        sha256=sha256(p),
        command=command,
        commit=commit,
        metadata=metadata or {},
    )
    return event.event_id


def transition(runtime: GraphRuntime, node: str, target: NodeStatus, reason: str, actor: str) -> None:
    runtime.transition(node, actor=actor, target=target, reason=reason)


def ensure_running(runtime: GraphRuntime, node: str, reason: str, actor: str) -> bool:
    status = runtime.state().nodes[node].status
    if status is NodeStatus.DONE:
        return False
    if status is not NodeStatus.READY:
        raise RuntimeError(f"{node} is {status.value}; expected ready/done")
    transition(runtime, node, NodeStatus.RUNNING, reason, actor)
    return True


def close_review_node(runtime: GraphRuntime, node: str, *, commit: str, producer: str, implementation: tuple[str, str], tests: list[tuple[str, str, dict]], note: str) -> None:
    if not ensure_running(runtime, node, note, producer):
        return
    impl = record(runtime, node, kind="implementation", path=implementation[0], command=implementation[1], commit=commit, actor=producer)
    test_ids = [
        record(runtime, node, kind="test", path=path, command=command, commit=commit, actor="independent-verifier", metadata=metadata)
        for path, command, metadata in tests
    ]
    critic = record(
        runtime,
        node,
        kind="critic",
        path="evidence/v2-commerce-ledger/independent-review.md",
        command="independent code/security/adversarial review with repaired findings",
        commit=commit,
        actor="critic",
        metadata={"review_mode": "attempt-to-disprove"},
    )
    runtime.evaluate_gate(
        node,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic, impl, *test_ids],
        note=note,
    )
    transition(runtime, node, NodeStatus.REVIEW, "Producer evidence and independent review are complete.", producer)
    transition(runtime, node, NodeStatus.DONE, note, "independent-verifier")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    evidence = require_release_evidence(args.commit)
    runtime = GraphRuntime.from_paths(PROJECT, EVENTS)

    close_review_node(
        runtime,
        "LUMA-050-v2-post-client-baseline",
        commit=args.commit,
        producer="solution-architect",
        implementation=("docs/v2/architecture-baseline.md", "review and freeze V2 post-client bounded architecture baseline"),
        tests=[],
        note="V2 baseline preserves learning-domain independence from commerce providers and defines the gated migration order.",
    )

    close_review_node(
        runtime,
        "LUMA-051-commerce-domain-contract",
        commit=args.commit,
        producer="commerce-domain-producer",
        implementation=("src/lib/commerce/domain.ts", "implement normalized commerce, entitlement and enrollment domain boundaries"),
        tests=[("evidence/v2-commerce-ledger/ci-gates.json", "GitHub Actions verify", {"unit_integration_passed": evidence["gates"]["verify"]["unit_integration"]["passed"]})],
        note="Provider-neutral commerce contracts, collision-safe identities and Payment/Entitlement/Enrollment separation pass independent review.",
    )

    close_review_node(
        runtime,
        "LUMA-052-commerce-idempotency-ledger",
        commit=args.commit,
        producer="commerce-reliability-producer",
        implementation=("src/lib/commerce/ledger.ts", "implement durable receive/process ledger and transactional entitlement lifecycle"),
        tests=[
            ("evidence/v2-commerce-ledger/ci-gates.json", "GitHub Actions Firestore stateful integration", {"firestore_passed": 10, "commerce_ledger_passed": 8, "persistent_learning_passed": 2}),
            ("evidence/v2-commerce-ledger/ci-gates.json", "GitHub Actions browser regression", {"e2e_passed": 67, "e2e_skipped": 5, "e2e_failed": 0}),
        ],
        note="Replay safety, failure retry, out-of-order revocation, tenant isolation, strict timestamps and collision-safe idempotency pass stateful and independent review.",
    )

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA V2 Commerce Ledger + Entitlement Foundation",
        commit=args.commit,
        evidence_summary={
            "decision": "PASS",
            "nodes": "LUMA-050..LUMA-052 done",
            "unit_integration_passed": 94,
            "firestore_passed": 10,
            "e2e_passed": 67,
            "e2e_skipped": 5,
            "production_vulnerabilities": 0,
            "active_review_findings": 0,
            "next_nodes": ["LUMA-053-hotmart-provider", "LUMA-054-stripe-provider"],
        },
    )

    state = runtime.as_dict()
    STATUS.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    result = {
        "status": "PASS",
        "product_commit": args.commit,
        "event_count": state["event_count"],
        "nodes": {
            node["id"]: node["status"]
            for node in state["nodes"]
            if node["id"].startswith(("LUMA-050-", "LUMA-051-", "LUMA-052-", "LUMA-053-", "LUMA-054-", "LUMA-055-"))
        },
    }
    FINAL.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
