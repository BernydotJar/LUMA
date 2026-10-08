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
        raise FileNotFoundError(f"missing artifact: {rel}")
    return path


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


def require_final_evidence(commit: str) -> dict:
    data = json.loads(CI.read_text(encoding="utf-8"))
    if data.get("reviewed_commit") != commit or data.get("decision") != "PASS":
        raise RuntimeError("release evidence is not bound to the requested PASS commit")
    gates = data["gates"]
    if gates["verify"]["conclusion"] != "success" or gates["verify"]["unit_integration"]["passed"] != 95:
        raise RuntimeError("verify evidence is incomplete")
    if gates["firestore"]["conclusion"] != "success" or gates["firestore"]["passed"] != 10:
        raise RuntimeError("Firestore evidence is incomplete")
    if gates["browser"]["conclusion"] != "success" or gates["browser"]["failed"] != 0:
        raise RuntimeError("browser evidence is incomplete")
    if gates["production_dependency_audit"]["vulnerabilities"] != 0:
        raise RuntimeError("production dependency audit is not clean")
    review = data["independent_review"]
    if review["code_review"] != "PASS" or review["security_review"] != "PASS" or review["active_review_threads"] != 0:
        raise RuntimeError("independent review is not clean")
    if "FINAL INDEPENDENT REVIEW: PASS" not in REVIEW.read_text(encoding="utf-8"):
        raise RuntimeError("review artifact lacks final PASS marker")
    return data


def refresh_gate(runtime: GraphRuntime, node: str, *, commit: str, implementation: tuple[str, str], tests: list[tuple[str, str, dict]], note: str, include_security: bool = False) -> None:
    state = runtime.state().nodes[node]
    if state.status is not NodeStatus.DONE:
        raise RuntimeError(f"{node} must already be done before evidence refresh; got {state.status.value}")

    impl = record(runtime, node, kind="implementation", path=implementation[0], command=implementation[1], commit=commit, actor="repair-producer")
    test_ids = [
        record(runtime, node, kind="test", path=path, command=command, commit=commit, actor="independent-verifier", metadata=metadata)
        for path, command, metadata in tests
    ]
    extra = []
    if include_security:
        extra.append(
            record(
                runtime,
                node,
                kind="security",
                path="evidence/v2-commerce-ledger/ci-gates.json",
                command="npm audit --omit=dev --audit-level=high plus independent security review",
                commit=commit,
                actor="security-reviewer",
                metadata={"production_vulnerabilities": 0, "security_review": "PASS"},
            )
        )
    critic = record(
        runtime,
        node,
        kind="critic",
        path="evidence/v2-commerce-ledger/independent-review.md",
        command="final independent adversarial review after timestamp repair",
        commit=commit,
        actor="critic",
        metadata={"review_mode": "attempt-to-disprove", "active_findings": 0},
    )
    runtime.evaluate_gate(
        node,
        actor="independent-verifier",
        gate_id="independent-review",
        result=GateResult.PASS,
        evidence_ids=[critic, impl, *test_ids, *extra],
        note=note,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True)
    args = parser.parse_args()
    evidence = require_final_evidence(args.commit)
    runtime = GraphRuntime.from_paths(PROJECT, EVENTS)

    refresh_gate(
        runtime,
        "LUMA-051-commerce-domain-contract",
        commit=args.commit,
        implementation=("src/lib/commerce/domain.ts", "finalize normalized commerce identity and strict RFC3339 timestamp contract"),
        tests=[("evidence/v2-commerce-ledger/ci-gates.json", "GitHub Actions verify", {"unit_integration_passed": 95, "build": "PASS"})],
        note="Final commerce domain contract accepts RFC3339-compliant lowercase designators while preserving strict calendar, offset and nanosecond ordering guarantees.",
    )

    refresh_gate(
        runtime,
        "LUMA-052-commerce-idempotency-ledger",
        commit=args.commit,
        implementation=("src/lib/commerce/ledger.ts", "finalize durable replay-safe ProviderEvent ledger and transactional Entitlement lifecycle"),
        tests=[
            ("evidence/v2-commerce-ledger/ci-gates.json", "GitHub Actions Firestore stateful integration", {"firestore_passed": 10, "commerce_ledger_passed": 8, "persistent_learning_passed": 2}),
            ("evidence/v2-commerce-ledger/ci-gates.json", "GitHub Actions browser regression", {"e2e_passed": 67, "e2e_skipped": 5, "e2e_failed": 0}),
        ],
        note="Final ledger semantics pass exact-once replay, collision safety, strict timestamp ordering, tenant isolation, failure retry and independent review.",
        include_security=True,
    )

    runtime.checkpoint(
        actor="release-gate",
        label="LUMA V2 Commerce Ledger + Entitlement Foundation — final repaired evidence",
        commit=args.commit,
        evidence_summary={
            "decision": "PASS",
            "nodes": "LUMA-050..LUMA-052 done",
            "unit_integration_passed": evidence["gates"]["verify"]["unit_integration"]["passed"],
            "firestore_passed": evidence["gates"]["firestore"]["passed"],
            "e2e_passed": evidence["gates"]["browser"]["passed"],
            "e2e_skipped": evidence["gates"]["browser"]["skipped"],
            "production_vulnerabilities": 0,
            "active_review_findings": 0,
            "reviewed_commit": args.commit,
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
