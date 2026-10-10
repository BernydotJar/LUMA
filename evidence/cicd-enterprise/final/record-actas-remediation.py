"""Append observed actAs failure and scoped IAM remediation using Graph Harness."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, '/workspace/projects/Graph-harness-sdlc-control-plane')
from graph_harness.runtime import GraphRuntime

NODE = 'LUMA-CICD-002-release-pipeline'
BASE = 'evidence/cicd-enterprise/final/'
receipt = ROOT / (BASE + 'actas-graph-receipt.json')
assert not receipt.exists(), 'Identity remediation already recorded; do not duplicate append-only events'
failure = json.loads((ROOT / (BASE + 'failed-deploy-attempt2.json')).read_text())
repair = json.loads((ROOT / (BASE + 'actas-remediation.json')).read_text())
critic = json.loads((ROOT / (BASE + 'granite-actas-review.json')).read_text())
assert failure['status'] == 'FAILED'
assert any('iam.serviceAccounts.actAs' in ev.get('error', '') for ev in failure['events'])
assert any(ev.get('phase') == 'RECOVERY_NOT_NEEDED_PRIOR_BUILD_STILL_SERVING' for ev in failure['events'])
assert repair['status'] == 'VERIFIED_SCOPED_BINDING'
assert repair['target'] == 'projects/luma-learning-intelligence/serviceAccounts/firebase-app-hosting-compute@luma-learning-intelligence.iam.gserviceaccount.com'
assert repair['member'] == 'serviceAccount:luma-github-release@luma-learning-intelligence.iam.gserviceaccount.com'
assert repair['role'] == 'roles/iam.serviceAccountUser'
assert repair['bindingsAdded'] == 1
assert repair['before']['bindingCount'] == 0 and repair['after']['bindingCount'] == 1
assert repair['after']['scopedGrantVerified'] is True
assert critic['complete'] is True and critic['evaluation']['verdict'] == 'CONDITIONAL_PASS'
assert not any(x['severity'].lower() in ('critical','high') for x in critic['evaluation']['findings'])
commit = subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
runtime = GraphRuntime.from_paths(ROOT / 'graph-harness.project.json', ROOT / 'graph-harness.events.jsonl')
assert runtime.state().nodes[NODE].status.value == 'review'
initial = len(runtime.state().events)
for actor, kind, result, artifact, note in [
 ('github-actions-verifier', 'identity-execution', 'FAIL', BASE+'failed-deploy-attempt2.json', 'Actual second attempt: createBuild failed at service account actAs; previous production traffic remained intact.'),
 ('fixer', 'configuration-remediation', 'PASS', BASE+'actas-remediation.json', 'Granted roles/iam.serviceAccountUser ONLY on existing App Hosting compute service account to the OIDC release account.'),
 ('ibm-granite-critic', 'configuration-critic', 'PASS', BASE+'granite-actas-review.json', 'Independent Granite conditional pass for narrow IAM scope; this is not a production release PASS.'),
 ('independent-verifier', 'configuration-verification', 'PASS', BASE+'actas-remediation.json', 'Read-back verified one scoped binding, etag policy, existing identity, and unchanged project-level permissions.')
]:
    data=ROOT/artifact
    runtime.record_evidence(NODE,actor=actor,kind=kind,result=result,artifact=artifact,sha256=hashlib.sha256(data.read_bytes()).hexdigest(),command='Observed GitHub Actions failure, scoped IAM grant and Firebase/IAM read-back',commit=commit,metadata={'note':note,'workflow_run':'38031714611','failed_attempt':2,'current_attempt':3,'production_verified':False})
state=runtime.state()
summary={'eventsAppended':len(state.events)-initial,'totalEvents':len(state.events),'nodeStatus':state.nodes[NODE].status.value,'production':'PENDING_CURRENT_WORKFLOW'}
receipt.write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
