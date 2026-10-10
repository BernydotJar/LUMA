"""Append the observed identity failure and narrow repair with the existing kernel."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, '/workspace/projects/Graph-harness-sdlc-control-plane')
from graph_harness.runtime import GraphRuntime
NODE = 'LUMA-CICD-002-release-pipeline'
migration_path = 'evidence/cicd-enterprise/final/immutable-oidc-migration.json'
critic_path = 'evidence/cicd-enterprise/final/granite-oidc-review.json'
failure_path = 'evidence/cicd-enterprise/final/first-main-authentication-failure.log'
migration = json.loads((ROOT / migration_path).read_text())
critic = json.loads((ROOT / critic_path).read_text())
assert migration['permissionChanges'] == [] and migration['scopeChanges'] == []
assert migration['mappingUnchanged'] and migration['issuerUnchanged']
assert migration['actualCondition'] == migration['expectedCondition']
assert migration['githubOidcSettings']['use_immutable_subject'] is True
old = "assertion.sub == 'repo:BernydotJar/LUMA:environment:production'"
new = "assertion.sub == 'repo:BernydotJar@16258017/LUMA@1403901485:environment:production'"
assert migration['actualCondition'] == migration['beforeCondition'].replace(old, new)
assert critic['complete'] and critic['evaluation']['verdict'] == 'PASS'
assert critic['migrationSha256'] == hashlib.sha256((ROOT / migration_path).read_bytes()).hexdigest()
assert not any(item['severity'] in ('critical', 'high') for item in critic['evaluation']['findings'])
assert 'rejected by the attribute condition' in (ROOT / failure_path).read_text()
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
runtime = GraphRuntime.from_paths(ROOT / 'graph-harness.project.json', ROOT / 'graph-harness.events.jsonl')
initial = len(runtime.state().events)
assert runtime.state().nodes[NODE].status.value == 'review'
for actor, kind, result, artifact, note in [
    ('github-actions-verifier', 'identity-execution', 'FAIL', failure_path, 'Attempt 1 failed before deployment; production success is not claimed.'),
    ('fixer', 'configuration-remediation', 'PASS', migration_path, 'Changed only the exact immutable OIDC subject reported by GitHub; no permissions or other predicates changed.'),
    ('ibm-granite-critic', 'configuration-critic', 'PASS', critic_path, 'Raw independent local model review of the exact operational migration; no critical or high findings.'),
    ('independent-verifier', 'configuration-verification', 'PASS', migration_path, 'Verified exact before/after substitution, trusted GitHub IDs, unchanged scope and critic artifact digest; runtime success remains pending.'),
]:
    runtime.record_evidence(NODE, actor=actor, kind=kind, result=result, artifact=artifact,
        sha256=hashlib.sha256((ROOT / artifact).read_bytes()).hexdigest(),
        command='Read verified GitHub OIDC configuration and narrow IAM migration receipts',
        commit=commit, metadata={'note': note, 'workflow_run': '38031714611', 'failed_attempt': 1, 'application_source_changed': False})
state = runtime.state()
print(json.dumps({'eventsAppended': len(state.events) - initial, 'chainEvents': len(state.events), 'nodeStatus': state.nodes[NODE].status.value, 'production': 'NOT_YET_VERIFIED'}))
