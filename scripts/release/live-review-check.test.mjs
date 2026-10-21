import { test } from 'vitest';
import assert from 'node:assert/strict';
import { assertCurrentIndependentReview, assertReceiptOnlyHeadAdvance } from './live-review-check.mjs';

const REVIEWED='a'.repeat(40);
const EVIDENCE_COMMIT='b'.repeat(40);
const approval={schemaVersion:2,status:'PASS',testedCommit:REVIEWED,
  review:{method:'github-human-approval',reviewer:'external-auditor',reviewId:901,commitSha:REVIEWED}};
const pr={number:71,head:{sha:EVIDENCE_COMMIT,repo:{full_name:'BernydotJar/LUMA'}},
  base:{ref:'main'},state:'open',merged:false,user:{login:'BernydotJar'}};
const commits=[{sha:REVIEWED,author:{login:'BernydotJar'},committer:{login:'sandbox-agent'}},
  {sha:EVIDENCE_COMMIT,author:{login:'BernydotJar'},committer:{login:'BernydotJar'}}];
const approved={id:901,user:{login:'external-auditor',type:'User'},state:'APPROVED',
  commit_id:REVIEWED,submitted_at:'2026-10-20T18:00:00Z'};
const receiptOnlyCompare={status:'ahead',ahead_by:1,behind_by:0,
  base_commit:{sha:REVIEWED},
  commits:[{sha:EVIDENCE_COMMIT,parents:[{sha:REVIEWED}]}],
  files:[{filename:'evidence/cicd-enterprise/release-approval.json',status:'modified'}]};
const check=(a=approval,p=pr,c=[],r=[approved],history=commits,
    allowlist='external-auditor',delta=receiptOnlyCompare) =>
  assertCurrentIndependentReview(a,p,EVIDENCE_COMMIT,c,r,history,allowlist,delta);

test('evidence-only commit retains an authenticated independent approval of exactly the same source', () => {
  assert.deepEqual(check(),{method:'github-human-approval',reviewer:'external-auditor',reviewId:901});
});

test('dismissal, changed reviewer or a later change request revoke a previously signed approval', () => {
  assert.throws(()=>check(approval,pr,[],[{...approved,state:'DISMISSED'}]),/approv|review/i);
  assert.throws(()=>check(approval,pr,[],[approved,{...approved,id:902,state:'CHANGES_REQUESTED',
    submitted_at:'2026-10-20T18:01:00Z'}]),/review|chang|approv/i);
  assert.throws(()=>check(approval,pr,[],[{...approved,id:999}]),/revoked|superseded/);
});

test('changing the PR head, source repository, signed SHA or signed reviewer fails closed', () => {
  assert.throws(()=>check(approval,{...pr,head:{...pr.head,sha:'c'.repeat(40)}}),/source|head/);
  assert.throws(()=>check(approval,{...pr,head:{...pr.head,repo:{full_name:'other/repo'}}}),/source|head/);
  assert.throws(()=>check({...approval,review:{...approval.review,commitSha:'c'.repeat(40)}}),/source-bound/);
  assert.throws(()=>check(approval,pr,[],[approved],[commits[1]]),/no longer/);
  assert.throws(()=>check(approval,pr,[],[approved],commits,'not-on-allowlist'),/approv|authorized/);
});

test('a later Codex report with findings cannot be overridden by a prior signed human review', () => {
  const comment={id:61,user:{login:'chatgpt-codex-connector[bot]'},
    updated_at:'2026-10-20T20:00:00Z',body:'<!-- codex-review-state:v1 '+
      JSON.stringify({code_review:{commit_sha:REVIEWED,status:'completed',
        has_any_findings:true,has_unresolved_findings:true}})+' -->'};
  assert.throws(()=>check(approval,pr,[comment],[approved]),/findings/);
});

test('previously clean Codex review also must still have the same verified GitHub receipt', () => {
  const bot={id:161,user:{login:'chatgpt-codex-connector[bot]'},
    body:'<!-- codex-review-state:v1 '+JSON.stringify({code_review:{commit_sha:REVIEWED,
      status:'completed',has_any_findings:false,has_unresolved_findings:false}})+' -->'};
  const signed={...approval,review:{method:'github-codex-clean-review',
    reviewer:'chatgpt-codex-connector[bot]',reviewId:161,commitSha:REVIEWED}};
  assert.deepEqual(check(signed,pr,[bot],[],commits,''),{
    method:'github-codex-clean-review',reviewer:'chatgpt-codex-connector[bot]',reviewId:161});
  assert.throws(()=>check(signed,pr,[{...bot,id:162}],[],commits,''),/revoked|superseded/);
});


test('receipt-only review inheritance rejects unreviewed source, workflow, catalog and evidence changes', () => {
  assert.equal(assertReceiptOnlyHeadAdvance(REVIEWED,REVIEWED,null),'EXACT_REVIEWED_HEAD');
  assert.equal(assertReceiptOnlyHeadAdvance(REVIEWED,EVIDENCE_COMMIT,receiptOnlyCompare),
    'SINGLE_SIGNED_RECEIPT_IMPORT');
  for (const filename of [
    'src/app/page.tsx', '.github/workflows/quality.yml',
    'docs/product-acceptance/catalog.json',
    'evidence/cicd-enterprise/independent-review.json',
  ]) {
    const changed={...receiptOnlyCompare,files:[{filename,status:'modified'}]};
    assert.throws(() => check(approval,pr,[],[approved],commits,'external-auditor',changed),
      /Unreviewed source or non-receipt/);
  }
  for (const modified of [
    {...receiptOnlyCompare,ahead_by:2},
    {...receiptOnlyCompare,behind_by:1},
    {...receiptOnlyCompare,status:'diverged'},
    {...receiptOnlyCompare,commits:[{sha:EVIDENCE_COMMIT,parents:[{sha:'c'.repeat(40)}]}]},
    {...receiptOnlyCompare,files:[...receiptOnlyCompare.files,{filename:'docs/README.md',status:'added'}]},
    {...receiptOnlyCompare,files:[{...receiptOnlyCompare.files[0],status:'renamed'}]},
    {...receiptOnlyCompare,files:[]},
    {...receiptOnlyCompare,commits:[]},
    null,
  ]) {
    assert.throws(() => check(approval,pr,[],[approved],commits,'external-auditor',modified),
      /Unreviewed source or non-receipt/);
  }
  // Without authenticated compare proof, even a genuine historic reviewer
  // cannot sign off on any newer PR HEAD simply because it is a descendant.
  assert.throws(() => assertCurrentIndependentReview(approval,pr,EVIDENCE_COMMIT,
    [],[approved],commits,'external-auditor'),/Unreviewed source or non-receipt/);
});
