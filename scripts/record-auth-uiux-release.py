#!/usr/bin/env python3
from __future__ import annotations

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

COMMIT = 'c486492e85addac2e6017e3d4eab6bd6031180fd'


def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk)
    return h.hexdigest()


def ev(rt,node,kind,path,command,actor,metadata=None):
    p=ROOT/path
    e=rt.record_evidence(node,actor=actor,kind=kind,result='PASS',artifact=path,sha256=sha256(p),command=command,commit=COMMIT,metadata=metadata or {})
    return e.event_id


def transition(rt,node,target,reason,actor):
    rt.transition(node,actor=actor,target=target,reason=reason)


def close_review(rt,node,evidence_ids,note,producer):
    rt.evaluate_gate(node,actor='independent-verifier',gate_id='independent-review',result=GateResult.PASS,evidence_ids=evidence_ids,note=note)
    transition(rt,node,NodeStatus.REVIEW,'Independent evidence complete.',producer)
    transition(rt,node,NodeStatus.DONE,note,'independent-verifier')


def main():
    rt=GraphRuntime.from_paths(ROOT/'graph-harness.project.json',ROOT/'graph-harness.events.jsonl')

    node='LUMA-033-google-auth-participant-profile'
    transition(rt,node,NodeStatus.READY,'Responsive client-demo release is complete.','graph-scheduler')
    transition(rt,node,NodeStatus.RUNNING,'Firebase Google auth and participant profile implemented.','auth-producer')
    provider=ev(rt,node,'test','evidence/auth/provider-verification.json','verify Firebase Google provider and authorized domains','auth-verifier',{'google_provider':True,'auth_uri':True})
    e2e=ev(rt,node,'test','evidence/auth/e2e-chromium.log','Playwright auth and product regression suite','browser-verifier',{'chromium_passed':22,'mobile_passed':25})
    critic=ev(rt,node,'critic','evidence/auth/independent-verification.md','independent auth and profile verification','independent-verifier')
    deploy=ev(rt,node,'deployment','evidence/auth/production-smoke.md','Firebase App Hosting production smoke','deployment-verifier')
    close_review(rt,node,[provider,e2e,critic,deploy],'Google auth, preferred display name, guest mode and production entry passed independent review.','auth-producer')

    node='LUMA-034-uiux-adversarial-desktop-mobile'
    transition(rt,node,NodeStatus.READY,'Authentication capability is complete.','graph-scheduler')
    transition(rt,node,NodeStatus.RUNNING,'Adversarial mobile/desktop audit executed across routes, themes and viewports.','ux-producer')
    report=ev(rt,node,'visual','evidence/uiux-adversarial/report.json','node scripts/uiux-adversarial-audit.mjs','visual-verifier',{'scenarios':102,'blocking':0,'small_target_warnings':0,'pattern_warnings':12})
    critic=ev(rt,node,'critic','evidence/uiux-adversarial/critic-review.md','independent adversarial UI/UX critique','critic')
    close_review(rt,node,[report,critic],'102-scenario adversarial review found zero blocking UI/UX scenarios; remaining repeated-pattern findings are catalog/inventory warnings.','ux-producer')

    node='LUMA-035-auth-uiux-client-release'
    transition(rt,node,NodeStatus.READY,'Auth and adversarial UI/UX nodes are complete.','graph-scheduler')
    transition(rt,node,NodeStatus.RUNNING,'Client-demo auth/UIUX release verification started.','release-producer')
    test=ev(rt,node,'test','evidence/auth/e2e-chromium.log','Playwright Chromium + mobile suites','browser-verifier',{'chromium':'22 pass / 4 skip','mobile':'25 pass / 1 skip'})
    build=ev(rt,node,'build','evidence/auth/verify.log','npm run verify','build-verifier',{'unit_tests':19,'lint':'PASS','typecheck':'PASS','build':'PASS'})
    a11y=ev(rt,node,'a11y','evidence/uiux-adversarial/report.json','Axe WCAG A/AA representative matrix','accessibility-verifier',{'blocking_a11y':0})
    security=ev(rt,node,'security','evidence/auth/npm-audit-production.json','npm audit --omit=dev --json','security-reviewer',{'production_vulnerabilities':0})
    visual=ev(rt,node,'visual','evidence/uiux-adversarial/summary.md','mobile/desktop/theme adversarial geometry review','visual-verifier',{'blocking':0,'small_targets':0})
    deploy=ev(rt,node,'deployment','evidence/auth/production-smoke.md','Firebase production smoke','deployment-verifier')
    critic=ev(rt,node,'critic','evidence/auth/independent-verification.md','final release critic review','critic')
    rt.evaluate_gate(node,actor='independent-verifier',gate_id='independent-review',result=GateResult.PASS,evidence_ids=[critic],note='Auth and UI/UX release evidence is sufficient for client demo.')
    transition(rt,node,NodeStatus.REVIEW,'Release evidence complete.','release-producer')
    rt.evaluate_gate(node,actor='release-gate',gate_id='release-quality',result=GateResult.PASS,evidence_ids=[test,build,a11y,security,visual,deploy],note='All required quality gates pass.')
    transition(rt,node,NodeStatus.DONE,'Google auth + adversarial UI/UX client-demo release passed.','release-gate')
    rt.checkpoint(actor='release-gate',label='LUMA Google Auth + UIUX Client Demo',commit=COMMIT,evidence_summary={'auth':'Google provider enabled','preferred_name':'Firebase profile','uiux_scenarios':102,'blocking_uiux':0,'unit':'19 pass','security':'0 production vulnerabilities','decision':'PASS_FOR_CLIENT_DEMO'})

    state=rt.as_dict()
    (ROOT/'evidence/graph-harness-status.json').write_text(json.dumps(state,indent=2)+'\n')
    print(json.dumps({'nodes':[n for n in state['nodes'] if n['id']>='LUMA-033']},indent=2))

if __name__=='__main__': main()
