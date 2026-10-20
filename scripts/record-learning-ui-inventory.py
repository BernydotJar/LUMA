#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, os, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
HARNESS=Path(os.environ.get('GRAPH_HARNESS_PATH','/workspace/projects/Graph-harness-sdlc-control-plane'))
sys.path.insert(0,str(HARNESS))
from graph_harness.model import GateResult, NodeStatus
from graph_harness.runtime import GraphRuntime

def sha(path:Path):
 h=hashlib.sha256(); h.update(path.read_bytes()); return h.hexdigest()

def ev(rt,node,kind,path,command,actor,metadata=None):
 p=ROOT/path
 return rt.record_evidence(node,actor=actor,kind=kind,result='PASS',artifact=path,sha256=sha(p),command=command,commit='5c82285',metadata=metadata or {}).event_id

rt=GraphRuntime.from_paths(ROOT/'graph-harness.project.json',ROOT/'graph-harness.events.jsonl')
node='LUMA-069-learning-surface-inventory'
rt.transition(node,actor='graph-scheduler',target=NodeStatus.READY,reason='LUMA-049 class intelligence release is complete in the authoritative ledger.')
rt.transition(node,actor='product-researcher',target=NodeStatus.RUNNING,reason='Current main UI surfaces and Platzi-informed learning gaps reviewed.')
doc=ev(rt,node,'research','docs/product/platzi-ui-learning-gap-map-2026.md','compare current LUMA routes/capabilities with Platzi-informed learning patterns','product-researcher',{'current_main':'5c82285','role_surfaces':'participant/coach/superuser'})
review=ev(rt,node,'critic','evidence/learning-ui/current-state-review.md','independent review of current UI simplification and capability gaps','independent-verifier',{'decision':'PASS_TO_NEXT_GRAPH'})
rt.evaluate_gate(node,actor='independent-verifier',gate_id='independent-review',result=GateResult.PASS,evidence_ids=[doc,review],note='Current navigation simplification is appropriate; next work should connect capabilities through progressive disclosure rather than add dashboard density.')
rt.transition(node,actor='product-researcher',target=NodeStatus.REVIEW,reason='Inventory and gap evidence complete.')
rt.transition(node,actor='independent-verifier',target=NodeStatus.DONE,reason='Role-separated UI inventory and Platzi gap map verified.')
state=rt.as_dict()
(ROOT/'evidence/graph-harness-status.json').write_text(json.dumps(state,indent=2)+'\n')
print(json.dumps({'ready_nodes':state.get('ready_nodes'),'node':next(n for n in state['nodes'] if n['id']==node)},indent=2))
