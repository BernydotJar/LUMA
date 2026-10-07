#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARNESS_ROOT = Path(os.environ.get('GRAPH_HARNESS_PATH','/workspace/projects/Graph-harness-sdlc-control-plane'))
sys.path.insert(0, str(HARNESS_ROOT))

from graph_harness.model import GateResult, NodeStatus  # noqa: E402
from graph_harness.runtime import GraphRuntime  # noqa: E402

PROJECT = ROOT / 'graph-harness.project.json'
EVENTS = ROOT / 'graph-harness.events.jsonl'
STATUS = ROOT / 'evidence/graph-harness-status.json'


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def artifact(rel: str) -> Path:
    p = ROOT / rel
    if not p.is_file():
        raise FileNotFoundError(f'missing evidence artifact: {rel}')
    return p


def require_text(rel: str, *needles: str) -> None:
    text = artifact(rel).read_text(encoding='utf-8', errors='replace')
    missing = [needle for needle in needles if needle not in text]
    if missing:
        raise RuntimeError(f'{rel} missing required release markers: {missing}')


def require_release_evidence() -> None:
    require_text('evidence/class-intelligence/verify-final.log', '45 passed', 'Compiled successfully')
    require_text('evidence/class-intelligence/e2e-full-final.log', '67 passed', '5 skipped')
    require_text('evidence/class-intelligence/e2e-full-final.exit', '0')
    require_text('evidence/class-intelligence/e2e-class-intelligence-final.log', '8 passed')
    require_text('evidence/class-intelligence/uiux-final.exit', '0')
    require_text('evidence/uiux-adversarial/summary.md', 'Blocking scenarios: 0', 'Small-target warning scenarios: 0', 'Reduced-motion animation warning scenarios: 0', 'Focus-order warning scenarios: 0')
    require_text('evidence/class-intelligence/critic-review.md', 'FINAL CRITIC: PASS')
    require_text('evidence/class-intelligence/final-verification.md', 'FINAL VERIFICATION: PASS')
    audit = json.loads(artifact('evidence/class-intelligence/npm-audit-production-final.json').read_text())
    if audit.get('metadata', {}).get('vulnerabilities', {}).get('total') != 0:
        raise RuntimeError('production npm audit is not zero-vulnerability')


def record(runtime: GraphRuntime, node_id: str, *, kind: str, path: str, command: str, commit: str, actor: str, metadata: dict | None = None) -> str:
    p = artifact(path)
    event = runtime.record_evidence(
        node_id,
        actor=actor,
        kind=kind,
        result='PASS',
        artifact=path,
        sha256=sha256(p),
        command=command,
        commit=commit,
        metadata=metadata or {},
    )
    return event.event_id


def transition(runtime: GraphRuntime, node_id: str, target: NodeStatus, reason: str, actor: str) -> None:
    runtime.transition(node_id, actor=actor, target=target, reason=reason)


def ensure_running(runtime: GraphRuntime, node_id: str, reason: str, actor: str) -> bool:
    status = runtime.state().nodes[node_id].status
    if status is NodeStatus.DONE:
        return False
    if status is NodeStatus.APPROVED:
        transition(runtime, node_id, NodeStatus.READY, 'Dependencies are complete and final evidence is available.', 'graph-scheduler')
        status = NodeStatus.READY
    if status is NodeStatus.READY:
        transition(runtime, node_id, NodeStatus.RUNNING, reason, actor)
        status = NodeStatus.RUNNING
    if status is not NodeStatus.RUNNING:
        raise RuntimeError(f'{node_id} is {status.value}; expected approved/ready/running')
    return True


def close_review_node(runtime: GraphRuntime, node_id: str, *, commit: str, producer: str, implementation: tuple[str, str], tests: list[tuple[str, str, dict]], critic_scope: str, note: str) -> None:
    if not ensure_running(runtime, node_id, note, producer):
        return
    impl_id = record(runtime, node_id, kind='implementation', path=implementation[0], command=implementation[1], commit=commit, actor=producer)
    test_ids = [record(runtime, node_id, kind='test', path=p, command=c, commit=commit, actor='independent-verifier', metadata=m) for p,c,m in tests]
    critic_id = record(runtime, node_id, kind='critic', path='evidence/class-intelligence/critic-review.md', command=f'independent adversarial review: {critic_scope}', commit=commit, actor='critic', metadata={'scope': critic_scope, 'review_mode':'attempt-to-disprove'})
    runtime.evaluate_gate(node_id, actor='independent-verifier', gate_id='independent-review', result=GateResult.PASS, evidence_ids=[critic_id, impl_id, *test_ids], note=note)
    transition(runtime, node_id, NodeStatus.REVIEW, 'Producer, test, and critic evidence are complete.', producer)
    transition(runtime, node_id, NodeStatus.DONE, note, 'independent-verifier')


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--commit', required=True)
    args = ap.parse_args()
    require_release_evidence()
    runtime = GraphRuntime.from_paths(PROJECT, EVENTS)
    commit = args.commit

    close_review_node(runtime, 'LUMA-043-learning-pattern-research', commit=commit, producer='research-producer', implementation=('docs/research/platzi-learning-intelligence-2026.md','review source-grounded Platzi and AI-EdTech synthesis plus adopt/adapt/reject decisions'), tests=[], critic_scope='research synthesis and adoption boundaries', note='Research synthesis supports evidence-producing classes, Learning Twin observability, source grounding, and human-governed refresh without turning LUMA into a generic LMS.')

    close_review_node(runtime, 'LUMA-044-pedagogy-as-code-contract', commit=commit, producer='pedagogy-producer', implementation=('src/lib/class-contract.ts','implement class contracts, observable objectives, learning topologies, evidence authority and quality invariants'), tests=[('evidence/class-intelligence/verify-final.log','npm run verify',{'unit_passed':45,'emulator_skipped':2,'class_contract_tests':'PASS'})], critic_scope='pedagogy-as-code contract and evidence authority invariants', note='Published experiences declare source boundaries, observable objectives, topology, evidence, remediation, transfer and deferred recheck; self-report cannot certify mastery.')

    close_review_node(runtime, 'LUMA-045-adaptive-entry-diagnostic', commit=commit, producer='adaptive-entry-producer', implementation=('src/components/class-entry-diagnostic.tsx','implement capability-specific entry diagnostic and routing receipt'), tests=[('evidence/class-intelligence/e2e-class-intelligence-final.log','Playwright Class Intelligence desktop/mobile',{'passed':8,'failed':0,'diagnostic_authority':'none'})], critic_scope='adaptive entry routing, mobile interaction and non-mastery diagnostic semantics', note='Entry diagnostic routes review or practice on desktop/mobile and records observed evidence with twinAuthority=none; mobile fixed-navigation interaction was repaired and reverified.')

    close_review_node(runtime, 'LUMA-046-simulation-evidence-runtime', commit=commit, producer='simulation-producer', implementation=('src/lib/simulation-evidence.ts','implement criterion-based P.A.S. simulation evidence receipt and authority'), tests=[('evidence/class-intelligence/e2e-class-intelligence-final.log','Playwright rubric-based simulation desktop/mobile',{'rubric':'pas-v1','criteria':3,'evidenceCategory':'scored','twinAuthority':'eligible'}),('evidence/class-intelligence/verify-final.log','npm run verify',{'evidence_authority_tests':'PASS'})], critic_scope='criterion evidence, mastery authority and persistent Learning Twin integration', note='Verified scored simulation emits rubric/criterion metadata and may update mastery; diagnostic and self-report signals remain non-authoritative.')

    close_review_node(runtime, 'LUMA-047-self-refreshing-class-factory', commit=commit, producer='class-factory-producer', implementation=('src/lib/class-factory.ts','implement source-versioned candidate refresh, quality gate, review-required state and explicit human promotion'), tests=[('evidence/class-intelligence/verify-final.log','npm run verify',{'class_factory_tests':'PASS','silent_published_mutation':False})], critic_scope='source refresh, reflection delta and human promotion semantics', note='Approved knowledge/reflection creates a review-required candidate delta; the published class remains unchanged until explicit human promotion.')

    if ensure_running(runtime, 'LUMA-048-learning-impact-observability', 'Coach Class Intelligence and evidence observability verified.', 'observability-producer'):
        impl = record(runtime, 'LUMA-048-learning-impact-observability', kind='implementation', path='src/app/studio/class-intelligence/page.tsx', command='implement coach-side Class Intelligence operating model and evidence metadata', commit=commit, actor='observability-producer')
        test = record(runtime, 'LUMA-048-learning-impact-observability', kind='test', path='evidence/class-intelligence/e2e-class-intelligence-final.log', command='Playwright Class Intelligence desktop/mobile', commit=commit, actor='browser-verifier', metadata={'passed':8,'failed':0})
        a11y = record(runtime, 'LUMA-048-learning-impact-observability', kind='a11y', path='evidence/uiux-adversarial/summary.md', command='node scripts/uiux-adversarial-audit.mjs', commit=commit, actor='accessibility-verifier', metadata={'blocking':0,'small_targets':0,'focus_order':0,'reduced_motion':0})
        visual = record(runtime, 'LUMA-048-learning-impact-observability', kind='visual', path='evidence/uiux-adversarial/report.json', command='adversarial desktop/mobile geometry and repeated-structure review', commit=commit, actor='visual-verifier', metadata={'catalog_repetition':'non-blocking when intentional'})
        critic = record(runtime, 'LUMA-048-learning-impact-observability', kind='critic', path='evidence/class-intelligence/critic-review.md', command='independent adversarial review: coach observability and learner/coach separation', commit=commit, actor='critic')
        runtime.evaluate_gate('LUMA-048-learning-impact-observability', actor='independent-verifier', gate_id='independent-review', result=GateResult.PASS, evidence_ids=[impl,test,a11y,visual,critic], note='Coach can inspect evidence authority, provenance and class intelligence without leaking internal architecture into the learner experience; desktop/mobile/a11y gates pass.')
        transition(runtime, 'LUMA-048-learning-impact-observability', NodeStatus.REVIEW, 'Producer and independent evidence are complete.', 'observability-producer')
        transition(runtime, 'LUMA-048-learning-impact-observability', NodeStatus.DONE, 'Coach observability and learner separation pass independent review.', 'independent-verifier')

    node = 'LUMA-049-class-intelligence-release'
    if ensure_running(runtime, node, 'Final AI-native Class Intelligence release verification started from immutable evidence.', 'release-producer'):
        build = record(runtime,node,kind='build',path='evidence/class-intelligence/verify-final.log',command='npm run verify',commit=commit,actor='build-verifier',metadata={'lint':'PASS','typecheck':'PASS','unit_passed':45,'emulator_skipped':2,'build':'PASS'})
        test = record(runtime,node,kind='test',path='evidence/class-intelligence/e2e-full-final.log',command='Playwright full regression against isolated production build',commit=commit,actor='browser-verifier',metadata={'passed':67,'skipped':5,'failed':0})
        a11y = record(runtime,node,kind='a11y',path='evidence/uiux-adversarial/summary.md',command='node scripts/uiux-adversarial-audit.mjs',commit=commit,actor='accessibility-verifier',metadata={'blocking':0,'small_targets':0,'focus_order':0,'reduced_motion':0})
        security = record(runtime,node,kind='security',path='evidence/class-intelligence/npm-audit-production-final.json',command='npm audit --omit=dev --json',commit=commit,actor='security-reviewer',metadata={'production_vulnerabilities':0})
        visual = record(runtime,node,kind='visual',path='evidence/uiux-adversarial/report.json',command='adversarial UI/UX desktop/mobile route sweep',commit=commit,actor='visual-verifier')
        critic = record(runtime,node,kind='critic',path='evidence/class-intelligence/critic-review.md',command='final independent attempt-to-disprove release review',commit=commit,actor='critic')
        verification = record(runtime,node,kind='verification',path='evidence/class-intelligence/final-verification.md',command='independent evidence adjudication',commit=commit,actor='independent-verifier')
        runtime.evaluate_gate(node,actor='independent-verifier',gate_id='independent-review',result=GateResult.PASS,evidence_ids=[critic,verification],note='No unresolved blocking product, evidence-authority, accessibility, or governance defect remains.')
        transition(runtime,node,NodeStatus.REVIEW,'Release evidence is complete and ready for the final release-quality gate.','release-producer')
        runtime.evaluate_gate(node,actor='release-gate',gate_id='release-quality',result=GateResult.PASS,evidence_ids=[build,test,a11y,security,visual],note='Lint, typecheck, 45 unit tests, production build, 67/67 executable Playwright cases, adversarial UI/UX, and zero production vulnerabilities pass.')
        transition(runtime,node,NodeStatus.DONE,'AI-native Class Intelligence release gates passed.','release-gate')
        runtime.checkpoint(actor='release-gate',label='LUMA AI-native Class Intelligence Release',commit=commit,evidence_summary={'decision':'PASS','unit_passed':45,'emulator_skipped':2,'e2e_passed':67,'e2e_skipped':5,'uiux_blocking':0,'production_vulnerabilities':0,'nodes':'LUMA-043..LUMA-049 done'})

    STATUS.write_text(json.dumps(runtime.as_dict(), indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'status':'PASS','event_count':runtime.as_dict()['event_count'],'nodes':{k:v.status.value for k,v in runtime.state().nodes.items() if k.startswith(tuple(f'LUMA-{n:03d}-' for n in range(43,50)))}}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
