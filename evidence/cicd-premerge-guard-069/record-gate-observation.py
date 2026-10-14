#!/usr/bin/env python3
"""Record independently checked remote CI results as a BLOCKED Graph gate.

Never asserts a source review or a production release PASS without proof.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, os.environ.get('GRAPH_HARNESS_ROOT', '/workspace/projects/Graph-harness-sdlc-control-plane'))
from graph_harness.runtime import GraphRuntime
from graph_harness.model import GateResult, NodeStatus

node_id = 'LUMA-069-pr-source-readiness'
run_id = '38516141684'
head_sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
expected_head = 'd30ec5d6d921521ab46827b6c8b0efd66155f7a9'
if head_sha != expected_head:
    raise RuntimeError('Source commit differs from the completed remote CI candidate')

def gh_api(path: str) -> dict:
    return json.loads(subprocess.check_output(['gh','api',path], cwd=root, text=True))

run = gh_api(f'repos/BernydotJar/LUMA/actions/runs/{run_id}')
jobs = gh_api(f'repos/BernydotJar/LUMA/actions/runs/{run_id}/jobs?filter=latest&per_page=100')['jobs']
if run.get('event') != 'pull_request' or run.get('head_sha') != expected_head or run.get('status') != 'completed':
    raise RuntimeError('Remote CI provenance does not match this branch')
quality_names = ('verify','security','firestore','identity-roles','browser')
for name in quality_names:
    matches=[j for j in jobs if j['name'] == name]
    if len(matches)!=1 or matches[0]['conclusion'] != 'success':
        raise RuntimeError(f'Quality check missing or unsuccessful: {name}')
required = {'release-readiness': 'failure', 'deploy': 'skipped'}
for name, outcome in required.items():
    matches=[j for j in jobs if j['name'] == name]
    if len(matches)!=1 or matches[0]['conclusion'] != outcome:
        raise RuntimeError(f'Expected fail-closed status not found for {name}')
if run.get('conclusion') != 'failure':
    raise RuntimeError('No overall CI failure; source attestation must remain blocked')

evidence_dir=root/'evidence/cicd-premerge-guard-069'
summary = {'runId': run_id, 'headSha': expected_head, 'event': run['event'],
           'conclusion': run['conclusion'], 'allFiveQualityPassed': True,
           'newSourceReady': False, 'deployed': False,
           'jobs': [{'name':j['name'], 'conclusion':j['conclusion']} for j in jobs],
           'actionsUrl':run['html_url']}
summary_path=evidence_dir/'remote-ci-38516141684.json'
summary_path.write_text(json.dumps(summary,indent=2)+'\n')

old_errors=[]
for p in sorted(evidence_dir.glob('granite-*-error.json')):
    obj=json.loads(p.read_text())
    old_errors.append({'file':p.name,'status':obj.get('status'), 'reason':obj.get('detail'),
                       'attemptedDigest':obj.get('sourceDigest')})
model_note=evidence_dir/'model-review-unavailable.json'
model_note.write_text(json.dumps({
 'status':'BLOCKED',
 'sourceReviewed':False,
 'candidateCommit':expected_head,
 'reason':'IBM Granite local Ollama returned HTTP 500 for guard/GRUV review attempts and then timed out on a minimal prompt; no completed independent review was obtained. Earlier attempts used an older digest and must not count as current-source verification.',
 'attempts':old_errors,
 'releaseGate':'NOT_APPROVED',
},indent=2)+'\n')

runtime=GraphRuntime.from_paths(root/'graph-harness.project.json',root/'graph-harness.events.jsonl')
node=runtime.state().nodes[node_id]
if node.status is NodeStatus.BLOCKED:
    raise RuntimeError('Already BLOCKED; do not duplicate Graph events')
if node.status is not NodeStatus.APPROVED:
    raise RuntimeError(f'Unexpected node status {node.status.value}')

def record(path: Path, kind: str, status: str, actor: str, extra: dict):
    return runtime.record_evidence(node_id,actor=actor,kind=kind,result=status,
      artifact=path.relative_to(root).as_posix(),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
      command='Read-only GitHub Actions proof and local reviewer availability; no synthetic PASS',
      commit=expected_head,metadata=extra).event_id

ci_id=record(summary_path,'ci','PASS','github-actions-verifier',{'qualityJobs':5,'sourceAttestation':'BLOCKED','overallRun':'failure'})
model_id=record(model_note,'critic','BLOCKED','ibm-granite-availability-verifier',{'review':False,'currentCandidateApproved':False})
runtime.evaluate_gate(node_id,actor='independent-verifier',gate_id='independent-review',
 result=GateResult.BLOCKED,evidence_ids=[ci_id,model_id],
 note='Five core GitHub QA jobs passed, but source-bound release approval is missing and IBM Granite is unavailable. No independent code review PASS, Graph DONE or Firebase deployment is asserted.')
runtime.transition(node_id,actor='release-controller',target=NodeStatus.BLOCKED,
 reason='Await completed independent critic/verifier and exact-source Graph release approval; release-readiness remains red by design')
runtime.checkpoint(actor='release-controller',label='LUMA-069 production HOLD on independent source review',
 commit=expected_head,evidence_summary={'qualityChecks':'5/5 PASS','review':'BLOCKED','deployment':'SKIPPED','priorProductionPreserved':True})
state=runtime.as_dict()
(root/'evidence/graph-harness-status.json').write_text(json.dumps(state,indent=2,ensure_ascii=False)+'\n')
(evidence_dir/'graph-observation.json').write_text(json.dumps({'node':node_id,
 'nodeStatus':runtime.state().nodes[node_id].status.value,'eventCount':state['event_count'],
 'ciRun':run_id,'commit':expected_head,'sourceReview':'BLOCKED','deployment':'SKIPPED'},indent=2)+'\n')
print(json.dumps({'node':node_id,'status':runtime.state().nodes[node_id].status.value,
  'events':state['event_count'],'ci':'5/5 PASS','sourceReadiness':'BLOCKED','deploy':'SKIPPED'}))
