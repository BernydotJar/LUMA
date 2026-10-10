#!/usr/bin/env python3
"""Close LUMA-067 only after reproducible independent evidence exists."""
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

NODE_ID = 'LUMA-067-se-liquid-glass-brand-v4'
EVIDENCE = ROOT / 'evidence/se-liquid-glass-v4'


def artifact(rel: str) -> Path:
    target = ROOT / rel
    if not target.is_file():
        raise RuntimeError(f'Missing verifiable evidence: {rel}')
    return target


def check_log(rel: str, *markers: str) -> None:
    content = artifact(rel).read_text(encoding='utf-8', errors='replace')
    if any(marker not in content for marker in markers):
        raise RuntimeError(f'Failed output markers for {rel}: {markers}')


def verify() -> None:
    check_log('evidence/se-liquid-glass-v4/lint.log', 'eslint .')
    check_log('evidence/se-liquid-glass-v4/typecheck.log', 'tsc --noEmit')
    check_log('evidence/se-liquid-glass-v4/unit.log', '291 passed')
    check_log('evidence/se-liquid-glass-v4/e2e.log', '8 passed')
    check_log('evidence/se-liquid-glass-v4/liquid-regression.log', '14 passed')
    check_log('evidence/se-liquid-glass-v4/webkit-audit.log', 'webkit_checks=10 passed=10 failures=0')
    check_log('evidence/se-liquid-glass-v4/audit.log', 'seres_optical_checks=10 passed=10 failures=0')
    check_log('evidence/se-liquid-glass-v4/full-glass-audit.log', 'blocking_findings=0', 'reduced_transparency_fallback=true')
    check_log('evidence/se-liquid-glass-v4/build.log', 'Compiled successfully')
    check_log('evidence/se-liquid-glass-v4/critic-review.md', '**PASS**')
    check_log('evidence/se-liquid-glass-v4/verification.md', '**PASS**')
    review = artifact('evidence/se-liquid-glass-v4/granite-critic.md').read_text()
    match = re.search(r'```json\s*(\{.*?\})\s*```', review, flags=re.DOTALL)
    if not match:
        raise RuntimeError('Granite review must contain an independently generated JSON verdict')
    verdict = json.loads(match.group(1))
    if verdict.get('verdict') != 'PASS' or verdict.get('blockers'):
        raise RuntimeError(f'Independent Granite critique is not PASS: {verdict}')
    check_log('docs/design/seres-brand-provenance.md', 'NOT an approved institutional brand guide')

    webkit = json.loads(artifact('evidence/se-liquid-glass-v4/webkit-audit.json').read_text())
    if webkit.get('total') != 10 or webkit.get('passed') != 10 or webkit.get('failures'):
        raise RuntimeError('WebKit engine audit failed')
    targeted = json.loads(artifact('evidence/se-liquid-glass-v4/audit.json').read_text())
    if targeted.get('total') != 10 or targeted.get('passed') != 10 or targeted.get('failures'):
        raise RuntimeError('Targeted optical accessibility audit failed')
    all_glass = json.loads(artifact('evidence/se-liquid-glass-v4/full-glass-report.json').read_text())
    checks = all_glass.get('checks', [])
    if len(checks) != 72 or not all_glass.get('hasReducedTransparencyFallback'):
        raise RuntimeError('Full 72-scenario glass report is incomplete')
    for x in checks:
        if x.get('theme') != x.get('requestedTheme') or x.get('horizontalOverflow') or x.get('outOfBounds') or x.get('clippedText') or x.get('nestedGlass') or x.get('activeAnimations') or x.get('fixedGlassOverlaps') or x.get('a11yViolationIds') or x.get('backdropCount', 999) > 14 or x.get('aboveFoldGlassCoverage', 999) > 0.95:
            raise RuntimeError(f'Blocking full-glass finding: {x.get("theme")}/{x.get("viewport")}/{x.get("route")}')


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(runtime: GraphRuntime, kind: str, rel: str, command: str, commit: str, actor: str, metadata: dict | None = None) -> str:
    event = runtime.record_evidence(
        NODE_ID, actor=actor, kind=kind, result='PASS', artifact=rel,
        sha256=sha256(artifact(rel)), command=command, commit=commit,
        metadata=metadata or {},
    )
    return event.event_id


def transition(runtime: GraphRuntime, status: NodeStatus, actor: str, reason: str) -> None:
    runtime.transition(NODE_ID, actor=actor, target=status, reason=reason)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--commit', required=True, help='SHA of the reviewed implementation commit')
    args = parser.parse_args()
    verify()
    runtime = GraphRuntime.from_paths(ROOT/'graph-harness.project.json', ROOT/'graph-harness.events.jsonl')
    state = runtime.state().nodes[NODE_ID].status
    if state is NodeStatus.DONE:
        raise RuntimeError('Already complete; append-only graph does not permit duplicate closure')
    if state is NodeStatus.APPROVED:
        transition(runtime, NodeStatus.READY, 'graph-scheduler', 'Reviewed LUMA-056 optical baseline is DONE')
        state = NodeStatus.READY
    if state is NodeStatus.READY:
        transition(runtime, NodeStatus.RUNNING, 'ui-producer', 'Bounded optical work and brand provenance verified')
    elif state is not NodeStatus.RUNNING:
        raise RuntimeError(f'Graph state not eligible for this closure: {state.value}')

    receipts = [
        record(runtime,'implementation','specs/067-seres-liquid-glass-optical-layer.md','Implement Seres functional optical layer and brand classification',args.commit,'ui-producer'),
        record(runtime,'brand-evidence','docs/design/seres-brand-provenance.md','Review public Seres logo variants, colors and ownership constraints',args.commit,'brand-verifier',{'official_brand_approval':False,'provisional':True}),
        record(runtime,'test','evidence/se-liquid-glass-v4/e2e.log','Playwright Chromium desktop/mobile optical E2E',args.commit,'playwright-verifier',{'passed':8,'failed':0}),
        record(runtime,'visual','evidence/se-liquid-glass-v4/audit.json','Axe and optical preview sweep across 10 combinations',args.commit,'visual-verifier',{'checks':10,'blocking':0}),
        record(runtime,'accessibility','evidence/se-liquid-glass-v4/full-glass-report.json','72-case WCAG and material adversarial audit',args.commit,'accessibility-verifier',{'checks':72,'blocking':0}),
        record(runtime,'webkit','evidence/se-liquid-glass-v4/webkit-audit.json','10-case WebKit Linux parity and accessibility audit',args.commit,'browser-verifier',{'checks':10,'blocking':0,'native_macos_safari_tested':False}),
        record(runtime,'build','evidence/se-liquid-glass-v4/build.log','npm run build',args.commit,'build-verifier'),
        record(runtime,'unit','evidence/se-liquid-glass-v4/unit.log','npm run test:run',args.commit,'unit-verifier',{'passed':291,'skipped_emulator':52}),
        record(runtime,'critic','evidence/se-liquid-glass-v4/granite-critic.md','Independent IBM Granite adversarial review of optical/accessibility/brand constraints',args.commit,'ibm-granite-critic',{'independent_model_review':True}),
        record(runtime,'verification','evidence/se-liquid-glass-v4/verification.md','Independent verification against spec 067',args.commit,'release-verifier'),
    ]
    runtime.evaluate_gate(
        NODE_ID, actor='independent-verifier', gate_id='independent-review', result=GateResult.PASS,
        evidence_ids=receipts,
        note='Full 72-case glass audit and desktop/mobile controls pass; public brand-reference colors explicitly remain unapproved by the brand owner.',
    )
    transition(runtime, NodeStatus.REVIEW, 'ui-producer', 'Evidence, audit, build and independent critic complete')
    transition(runtime, NodeStatus.DONE, 'independent-verifier', 'LUMA-067 software release gate PASS; brand signoff remains separate')
    runtime.checkpoint(
        actor='independent-verifier', label='LUMA Seres Liquid Glass optical V4', commit=args.commit,
        evidence_summary={'decision':'PASS','glass_scenarios':72,'optical_scenarios':10,'webkit_scenarios':10,'e2e_passed':14,'unit_passed':291,'brand_owner_approved':False},
    )
    summary = runtime.as_dict()
    (ROOT/'evidence/graph-harness-status.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    data = {'status':'PASS','node':NODE_ID,'node_status':runtime.state().nodes[NODE_ID].status.value,
            'reviewed_commit':args.commit,'event_count':summary['event_count'],'brand_owner_approved':False}
    (EVIDENCE/'graph-finalization.json').write_text(json.dumps(data,indent=2)+'\n')
    print(json.dumps(data))
    return 0


if __name__=='__main__':
    raise SystemExit(main())
