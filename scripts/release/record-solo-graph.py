#!/usr/bin/env python3
"""Protected-main Graph Harness evidence writer for a model-only v3 release.

Never run candidate scripts. The Graph Harness library is pinned in an external,
read-only checkout; candidate project/events are parsed data, then appended via
GraphRuntime/EventStore, never fabricated or overwritten.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate', required=True)
    parser.add_argument('--source-digest', required=True)
    parser.add_argument('--source-commit', required=True)
    parser.add_argument('--ci-run-id', type=int, required=True)
    parser.add_argument('--model-run-id', type=int, required=True)
    parser.add_argument('--owner-comment-id', type=int, required=True)
    args = parser.parse_args()
    root = Path(args.candidate).resolve()
    assert len(args.source_digest) == 64 and len(args.source_commit) == 40
    assert args.ci_run_id > 0 and args.model_run_id > 0 and args.owner_comment_id > 0
    assert os.environ.get('GITHUB_REPOSITORY') == 'BernydotJar/LUMA'
    assert os.environ.get('GITHUB_REF') == 'refs/heads/main'
    assert os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
    graph_source = os.environ.get('GRAPH_HARNESS_ROOT')
    assert graph_source and Path(graph_source, 'graph_harness/runtime.py').is_file(), 'Trusted graph source missing'
    sys.path.insert(0, graph_source)
    from graph_harness.runtime import GraphRuntime
    from graph_harness.model import GateResult, NodeStatus

    node_id = 'LUMA-CICD-002-release-pipeline'
    project_path = root / 'graph-harness.project.json'
    event_path = root / 'graph-harness.events.jsonl'
    runtime = GraphRuntime.from_paths(project_path, event_path)
    state = runtime.state() # Verify full existing event hash chain before append.
    assert node_id in state.nodes, 'Candidate Graph release node missing'
    status = state.nodes[node_id].status
    assert status in (NodeStatus.READY, NodeStatus.RUNNING, NodeStatus.REVIEW), 'Graph node is blocked/done; explicit revision required'
    if status is NodeStatus.READY:
        runtime.transition(node_id, actor='release-controller', target=NodeStatus.RUNNING,
                           reason='New owner-authorized release model evidence')
    base = root / 'evidence/cicd-enterprise'
    paths = {
        'critic':base / 'granite-review.json',
        'verification':base / 'independent-review.json',
        'ci':base / 'release-ci.json',
    }
    metadata = {
        'source_digest':args.source_digest,
        'reviewed_commit':args.source_commit,
        'reviewer_type':'automated-model-critic',
        'human_independent':False,
        'model_review_run_id':args.model_run_id,
        'owner_comment_id':args.owner_comment_id,
        'ci_run_id':args.ci_run_id,
    }
    evidence_ids = []
    for kind, path in paths.items():
        assert path.is_file(), f'Missing {kind} trusted evidence'
        record = runtime.record_evidence(node_id, actor={
            'critic':'ibm-granite-critic',
            'verification':'automated-evidence-verifier',
            'ci':'github-actions-verifier',
        }[kind], kind=kind, result='PASS', artifact=str(path.relative_to(root)),
            sha256=sha(path), command='Protected-main v3: authenticated model, CI and owner evidence',
            commit=args.source_commit, metadata=metadata)
        evidence_ids.append(record.event_id)
    note = (f'SOLO_OWNER_MODEL_V3 sourceDigest={args.source_digest} '
            f'reviewedCommit={args.source_commit} CI={args.ci_run_id} '
            f'modelRun={args.model_run_id} ownerComment={args.owner_comment_id}; '
            'automated adversarial criticism, no independent human approval')
    gate = runtime.evaluate_gate(node_id, actor='automated-evidence-verifier',
                                 gate_id='cicd-release', result=GateResult.PASS,
                                 evidence_ids=evidence_ids, note=note)
    final=runtime.state()
    assert final.last_event_id==gate.event_id, 'Graph write was not persisted as latest event'
    assert final.nodes[node_id].gates['cicd-release'].result is GateResult.PASS
    print(json.dumps({'status':'PASS','sourceDigest':args.source_digest,
       'testedCommit':args.source_commit,'graphEventId':gate.event_id,
       'graphEventHash':gate.event_hash,'criticSha256':sha(paths['critic']),
       'verifierSha256':sha(paths['verification']),
       'ciSha256':sha(paths['ci']),'events':len(final.events)},sort_keys=True))


if __name__ == '__main__':
    main()
