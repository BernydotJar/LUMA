#!/usr/bin/env python3
"""Append release observations with the existing Graph Harness; never edit hashes."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
HARNESS = Path(os.environ.get('GRAPH_HARNESS_ROOT', '/workspace/projects/Graph-harness-sdlc-control-plane'))
sys.path.insert(0, str(HARNESS))
from graph_harness.runtime import GraphRuntime
from graph_harness.model import GateResult, NodeStatus

NODE = 'LUMA-CICD-002-release-pipeline'
OUT = ROOT / 'evidence/cicd-enterprise'
CHECKS = ['verify', 'security', 'firestore', 'identity-roles', 'browser']

def command(*args: str) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True).strip()

def load(path: str) -> dict:
    return json.loads((ROOT / path).read_text())

def save(path: str, value: dict) -> None:
    (ROOT / path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def sha(path: str) -> str:
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--phase', choices=['prepare', 'release', 'production'], required=True)
    parser.add_argument('--ci-run')
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    project_path = ROOT / 'graph-harness.project.json'
    project = json.loads(project_path.read_text())
    for gate in [
        {'id': 'cicd-release', 'required_evidence_kinds': ['critic', 'verification', 'ci'], 'blocking': True},
        {'id': 'cicd-production', 'required_evidence_kinds': ['production'], 'blocking': True},
    ]:
        if not any(item['id'] == gate['id'] for item in project['gate_definitions']):
            project['gate_definitions'].append(gate)
    if not any(item['id'] == NODE for item in project['nodes']):
        project['nodes'].append({
            'id': NODE, 'kind': 'release-engineering', 'title': 'Protected CI, keyless release and exact production verification',
            'status': 'ready', 'depends_on': [], 'capability': 'enterprise-delivery',
            'gates': {'review': ['cicd-release'], 'done': ['cicd-production']},
            'allowed_paths': ['.github/**', 'scripts/release/**', 'docs/operations/**', 'evidence/cicd-enterprise/**', 'src/app/api/version/**', 'src/generated/**', 'graph-harness.project.json', 'graph-harness.events.jsonl'],
            'metadata': {'authorization': 'Explicit user request to implement the supplied enterprise CI/CD brief; no production release before verification'},
        })
    project_path.write_text(json.dumps(project, indent=2, ensure_ascii=False) + '\n')
    runtime = GraphRuntime.from_paths(project_path, ROOT / 'graph-harness.events.jsonl')
    state = runtime.state()  # Validates the complete existing chain before append.
    original_count = len(state.events)
    commit = command('git', 'rev-parse', 'HEAD')
    def transition(target: NodeStatus, reason: str) -> None:
        if runtime.state().nodes[NODE].status != target:
            runtime.transition(NODE, actor='release-controller', target=target, reason=reason)
    def evidence(path: str, kind: str, result: str, actor: str, metadata: dict | None = None) -> str:
        return runtime.record_evidence(NODE, actor=actor, kind=kind, result=result, artifact=path, sha256=sha(path), command=f'CI/CD {args.phase}: inspect actual evidence; no synthetic success', commit=commit, metadata=metadata or {}).event_id
    gate_id = 'cicd-production' if args.phase == 'production' else 'cicd-release'
    try:
        status = state.nodes[NODE].status
        if status == NodeStatus.DONE:
            raise ValueError('Completed release requires a new revision through Graph Harness invalidation; refusing silent reuse')
        if status == NodeStatus.BLOCKED:
            transition(NodeStatus.READY, 'Resume with new independently verifiable evidence')
        if runtime.state().nodes[NODE].status == NodeStatus.READY:
            transition(NodeStatus.RUNNING, 'User-authorized incremental implementation')
        if args.phase == 'prepare':
            evidence('docs/operations/cicd.md', 'implementation', 'PASS', 'producer', {'scope': 'Implementation present; live release not yet verified'})
            runtime.evaluate_gate(NODE, actor='independent-verifier', gate_id=gate_id, result=GateResult.BLOCKED, evidence_ids=[], note='New candidate CI, adversarial closure, source-bound approval and production verification are pending.')
            transition(NodeStatus.BLOCKED, 'Preserve the current production revision until release prerequisites are proved')
            print(json.dumps({'status': 'BLOCKED', 'eventsAppended': len(runtime.state().events) - original_count}))
            return 0
        if not args.ci_run or not args.ci_run.isdigit():
            raise ValueError('A concrete GitHub Actions run is required')
        base = f'repos/BernydotJar/LUMA/actions/runs/{args.ci_run}'
        run = json.loads(command('gh', 'api', base))
        jobs = json.loads(command('gh', 'api', base + '/jobs?filter=latest&per_page=100'))['jobs']
        assert run['head_sha'] == commit and run['conclusion'] == 'success', 'CI run does not verify the current commit'
        for name in CHECKS:
            matching = [job for job in jobs if job['name'] == name]
            assert len(matching) == 1 and matching[0]['conclusion'] == 'success', f'Unsuccessful check: {name}'
        summary = {'runId': args.ci_run, 'gitSha': commit, 'conclusion': run['conclusion'], 'url': run['html_url'], 'jobs': [{'name': job['name'], 'conclusion': job['conclusion'], 'url': job['html_url']} for job in jobs]}
        save(f'evidence/cicd-enterprise/{args.phase}-ci.json', summary)
        if args.phase == 'release':
            digest = command('node', 'scripts/release/review-gate.mjs', '--digest')
            critic_path = 'evidence/cicd-enterprise/granite-review.json'
            verifier_path = 'evidence/cicd-enterprise/independent-review.json'
            critic, verifier = load(critic_path), load(verifier_path)
            assert critic['complete'] is True and critic['reviewedSourceDigest'] == digest, 'Incomplete or stale Granite review'
            assert verifier['status'] == 'PASS' and verifier['reviewedSourceDigest'] == digest, 'Independent verification is missing or stale'
            dispositions = {item['id']: item for item in verifier.get('dispositions', [])}
            for finding in critic['evaluation'].get('findings', []):
                if finding.get('severity') in ['critical', 'high']:
                    disposition = dispositions.get(finding['id'], {})
                    assert disposition.get('status') in ['resolved', 'false-positive'] and disposition.get('evidence'), f'Open blocking finding: {finding["id"]}'
            assert verifier.get('unresolvedCritical') == 0 and verifier.get('unresolvedHigh') == 0
            changed = command('git', 'diff', '--name-only', 'HEAD').splitlines()
            material = [p for p in changed if p.startswith(('src/', 'public/', 'scripts/', '.github/', 'e2e/')) and p != 'src/generated/release-manifest.json']
            assert not material, 'Code changed after the tested commit'
            metadata = {'source_digest': digest}
            evidence(critic_path, 'adversarial-raw', critic['evaluation']['verdict'], 'ibm-granite-critic', metadata)
            critic_id = evidence(verifier_path, 'critic', 'PASS', 'independent-verifier', {**metadata, 'meaning': 'Granite finding dispositions, not a rewritten model verdict', 'raw_critic_sha256': sha(critic_path)})
            verifier_id = evidence(verifier_path, 'verification', 'PASS', 'independent-verifier', metadata)
            ci_id = evidence('evidence/cicd-enterprise/release-ci.json', 'ci', 'PASS', 'github-actions-verifier', metadata)
            gate = runtime.evaluate_gate(NODE, actor='independent-verifier', gate_id=gate_id, result=GateResult.PASS, evidence_ids=[critic_id, verifier_id, ci_id], note=f'Code review and all five checks passed for source digest {digest}; production remains separately gated.')
            transition(NodeStatus.REVIEW, 'Candidate approved for the independently verified main deployment workflow')
            save('evidence/cicd-enterprise/release-approval.json', {'schemaVersion': 1, 'status': 'PASS', 'sourceDigest': digest, 'testedCommit': commit, 'unresolvedCritical': 0, 'unresolvedHigh': 0, 'graphEventId': gate.event_id, 'graphEventHash': gate.event_hash, 'critic': {'sha256': sha(critic_path)}, 'verifier': {'sha256': sha(verifier_path)}})
            command('node', 'scripts/release/review-gate.mjs')
        else:
            result = load('evidence/cicd-enterprise/production/release-result.json')
            smoke = load('evidence/cicd-enterprise/production/smoke.json')
            assert result['status'] == 'VERIFIED' and result['gitSha'] == commit
            assert smoke['status'] == 'PASS' and smoke['gitSha'] == commit and not smoke['errors']
            assert any(job['name'] == 'deploy' and job['conclusion'] == 'success' for job in jobs)
            request = urllib.request.Request('https://luma--luma-learning-intelligence.us-central1.hosted.app/api/version', headers={'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(request, timeout=30) as response:
                assert response.status == 200 and json.load(response)['gitSha'] == commit
            proof = evidence('evidence/cicd-enterprise/production/release-result.json', 'production', 'PASS', 'github-actions-verifier', {'live_sha_rechecked': commit})
            runtime.evaluate_gate(NODE, actor='independent-verifier', gate_id=gate_id, result=GateResult.PASS, evidence_ids=[proof], note='Successful workflow, production traffic/SHA, browser smoke and independent live version recheck agree.')
            if runtime.state().nodes[NODE].status == NodeStatus.RUNNING:
                transition(NodeStatus.REVIEW, 'Release and production evidence are complete')
            transition(NodeStatus.DONE, 'Verified production release; no outstanding production gate')
        final = runtime.state()
        print(json.dumps({'status': final.nodes[NODE].status.value, 'eventsAppended': len(final.events) - original_count, 'chainEvents': len(final.events), 'lastEventId': final.last_event_id}))
        return 0
    except Exception as error:
        runtime.evaluate_gate(NODE, actor='independent-verifier', gate_id=gate_id, result=GateResult.BLOCKED, evidence_ids=[], note=str(error))
        if runtime.state().nodes[NODE].status not in [NodeStatus.DONE, NodeStatus.BLOCKED]:
            transition(NodeStatus.BLOCKED, str(error))
        print(f'BLOCKED: {error}', file=sys.stderr)
        return 1

if __name__ == '__main__':
    raise SystemExit(main())
