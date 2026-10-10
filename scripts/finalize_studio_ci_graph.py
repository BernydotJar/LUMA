#!/usr/bin/env python3
"""Close LUMA-068 test-only CI hardening after genuine evidence exists.

Append-only and idempotency-safe: will not reset or rewrite existing Graph events.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, os.environ.get('GRAPH_HARNESS_PATH', '/workspace/projects/Graph-harness-sdlc-control-plane'))
from graph_harness.model import GateResult, NodeStatus  # noqa: E402
from graph_harness.runtime import GraphRuntime  # noqa: E402

NODE_ID = 'LUMA-068-studio-ci-strict-locator'
DIR = 'evidence/ci-studio-auth-gate-068'


def artifact(rel: str) -> Path:
    p = ROOT / rel
    if not p.is_file():
        raise RuntimeError(f'Missing required evidence: {rel}')
    return p


def sha256(rel: str) -> str:
    return hashlib.sha256(artifact(rel).read_bytes()).hexdigest()


def require_markers(rel: str, *markers: str) -> None:
    content = artifact(rel).read_text(encoding='utf8', errors='replace')
    if any(marker not in content for marker in markers):
        raise RuntimeError(f'Incorrect or incomplete evidence markers: {rel}: {markers}')


def verify() -> None:
    require_markers(f'{DIR}/incident.md', '38088552918', 'strict mode violation')
    require_markers(f'{DIR}/stress.log', '24 passed')
    require_markers(f'{DIR}/full-e2e.log', '117 passed', '7 skipped')
    require_markers(f'{DIR}/lint.log', 'eslint .')
    require_markers(f'{DIR}/typecheck.log', 'tsc --noEmit')
    require_markers(f'{DIR}/unit.log', '291 passed', '52 skipped')
    require_markers(f'{DIR}/verification.md', '**PASS**')
    require_markers('specs/068-ci-studio-auth-gate.md', 'Root cause and scope')
    source = artifact('e2e/enterprise-boundary.spec.ts').read_text()
    if 'getByRole("status")' not in source or 'getByText(/Accede para consultar a tus participantes/i)' in source:
        raise RuntimeError('Unscoped locator regression: fix not present')
    if 'expect(authGate.getByRole("heading"' not in source or 'toHaveAttribute("href", "/login")' not in source:
        raise RuntimeError('Authenticated-access test assertions were weakened')
    raw = artifact(f'{DIR}/granite-critic.md').read_text()
    block = re.search(r'```json\s*(\{.*?\})\s*```', raw, re.DOTALL)
    if not block:
        raise RuntimeError('Missing independent model-review JSON receipt')
    verdict = json.loads(block.group(1))
    if verdict.get('verdict') != 'PASS' or verdict.get('blockers'):
        raise RuntimeError(f'Critic did not approve: {verdict}')


def add(runtime: GraphRuntime, kind: str, rel: str, command: str, actor: str, sha: str, metadata: dict | None = None) -> str:
    ev = runtime.record_evidence(
        NODE_ID, actor=actor, kind=kind, result='PASS', artifact=rel,
        sha256=sha256(rel), command=command, commit=sha,
        metadata=metadata or {},
    )
    return ev.event_id


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument('--commit', required=True, help='Reviewed implementation commit SHA')
    args = p.parse_args()
    verify()
    runtime = GraphRuntime.from_paths(ROOT/'graph-harness.project.json', ROOT/'graph-harness.events.jsonl')
    status = runtime.state().nodes[NODE_ID].status
    if status == NodeStatus.DONE:
        raise RuntimeError('Node already DONE; refusing duplicate append-only release')
    if status == NodeStatus.APPROVED:
        runtime.transition(NODE_ID, actor='graph-scheduler', target=NodeStatus.READY, reason='LUMA-067 complete; CI hotfix spec reviewed')
        status = NodeStatus.READY
    if status != NodeStatus.READY:
        raise RuntimeError(f'Node must be READY before producer: {status}')
    runtime.transition(NODE_ID, actor='qa-producer', target=NodeStatus.RUNNING, reason='Test selector change and evidence verified')
    receipts = [
        add(runtime,'implementation','e2e/enterprise-boundary.spec.ts','Scope global text locator to the Studio access-status region','qa-producer',args.commit),
        add(runtime,'specification','specs/068-ci-studio-auth-gate.md','Document root cause, scope and CI release acceptance','product-architect',args.commit),
        add(runtime,'incident',f'{DIR}/incident.md','Inspect GitHub Actions failing job 114320374253','release-engineer',args.commit,{'failed_run_id':38088552918}),
        add(runtime,'stress-test',f'{DIR}/stress.log','12 repeated desktop + 12 mobile Playwright tests','playwright-verifier',args.commit,{'passed':24,'failed':0}),
        add(runtime,'regression-test',f'{DIR}/full-e2e.log','Full Playwright standalone production build','playwright-verifier',args.commit,{'passed':117,'skipped':7,'failed':0}),
        add(runtime,'unit-test',f'{DIR}/unit.log','npm run test:run','unit-verifier',args.commit,{'passed':291,'skipped_emulator':52}),
        add(runtime,'static-analysis',f'{DIR}/typecheck.log','npm run typecheck','typescript-verifier',args.commit),
        add(runtime,'lint',f'{DIR}/lint.log','npm run lint','eslint-verifier',args.commit),
        add(runtime,'critic',f'{DIR}/granite-critic.md','Independent IBM Granite targeted QA review','ibm-granite-critic',args.commit),
        add(runtime,'verification',f'{DIR}/verification.md','Independent software correction verifier','independent-verifier',args.commit,{'production_deployed':False}),
    ]
    runtime.evaluate_gate(
        NODE_ID, actor='independent-verifier', gate_id='independent-review', result=GateResult.PASS,
        evidence_ids=receipts,
        note='Test-only CI hotfix: 24 repeated focused and 117 full browser tests pass, no bypass to authentication or release rules. Post-merge production promotion is separate.',
    )
    runtime.transition(NODE_ID, actor='qa-producer', target=NodeStatus.REVIEW, reason='All local evidence and independent critic PASS')
    runtime.transition(NODE_ID, actor='independent-verifier', target=NodeStatus.DONE, reason='LUMA-068 software hotfix gate PASS; CI and production rollout remain separate')
    runtime.checkpoint(
        actor='independent-verifier', label='LUMA Studio authentication CI strict-locator hotfix', commit=args.commit,
        evidence_summary={'decision':'PASS','focused_e2e':24,'full_e2e':117,'unit_tests':291,'ci_prod_gate':'pending'},
    )
    state=runtime.as_dict()
    (ROOT/'evidence/graph-harness-status.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
    receipt={'node':NODE_ID,'node_status':runtime.state().nodes[NODE_ID].status.value,
             'reviewed_commit':args.commit,'event_count':state['event_count'],'software_gate':'PASS','production_deployed':False}
    (ROOT/DIR/'graph-finalization.json').write_text(json.dumps(receipt,indent=2)+'\n')
    print(json.dumps(receipt))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
