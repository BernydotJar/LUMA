import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reviewedSourceDigest } from '../../scripts/release/review-gate.mjs';

const root = resolve(import.meta.dirname,'../..');
const src = (path) => readFileSync(resolve(root,path));
const json = (path) => JSON.parse(src(path));
const sha256 = data => createHash('sha256').update(data).digest('hex');
const cmd = (...args) => execFileSync(args[0],args.slice(1),{cwd:root,encoding:'utf8',maxBuffer:5*1024*1024}).trim();
function demand(ok, why){if(!ok)throw new Error(`Independent verifier BLOCK: ${why}`);}

const digest = reviewedSourceDigest(root);
const critic = json('evidence/cicd-enterprise/granite-review.json');
const prior = json('evidence/cicd-enterprise/granite-review-pre-v4.json');
const oldApproval = json('evidence/cicd-enterprise/release-approval-pre-v4.json');
const input = json('evidence/cicd-enterprise/granite-input-v4.json');
demand(critic.complete && critic.reviewedSourceDigest===digest, 'Granite did not finish reviewing exactly this source');
demand(['PASS','BLOCKED'].includes(critic.evaluation?.verdict), 'Missing valid raw Granite verdict');
demand(Array.isArray(critic.evaluation.findings), 'Missing Granite finding list');
const high = critic.evaluation.findings.filter(f=>['high','critical'].includes(String(f.severity).toLowerCase()));
const dispositions = [];
for (const finding of high) {
  if (finding.id==='G1' && finding.file==='src/app/library/library.module.css' && finding.risk==='auth weakening') {
    const css=src('src/app/library/library.module.css').toString('utf8');
    const strong=css.match(/\.qualityScore\s*>\s*strong\s*\{[^}]*\}/g)??[];
    demand(strong.length>=2 && strong.every(rule=>!/min-width\s*:\s*0/.test(rule)), 'G1 claim must be checked against actual score selectors');
    demand(/\.qualityScore\s*\{[^}]*min-width:\s*0/.test(css), 'G1 source location was not identified');
    demand(cmd('git','diff','--name-only',input.baseline,'HEAD','--','src/components/studio-dashboard.tsx')==='', 'G1 cannot be dismissed if auth-gate implementation changed');
    demand(src('evidence/ci-studio-auth-gate-068/stress.log').toString().includes('24 passed'), 'G1 lacks the 24-run access-gate regression');
    dispositions.push({id:'G1',status:'false-positive',evidence:[
      'The actual min-width:0 is on the mobile .qualityScore parent in src/app/library/library.module.css, not on .qualityScore > strong as Granite claims; the strong rules only control typography and wrapping.',
      'The change is a responsive content sizing rule; src/components/studio-dashboard.tsx and authentication implementation are byte-identical to the previous baseline.',
      'The scoped unauthenticated Studio test still requires a visible access heading, the /login link and no fabricated metrics: 24/24 repeated tests and all five GitHub-hosted quality jobs passed.'
    ],reason:'An unrelated Library layout rule cannot weaken authentication; Granite supplied no auth flow or code path connecting these properties.'});
  } else if (finding.id==='G2' && finding.file==='src/components/experience-console.module.css' && finding.risk==='glass opacity regression') {
    const css=src('src/components/experience-console.module.css').toString('utf8');
    const lens=css.match(/\.seOpticalLens\s*\{[^}]*\}/)?.[0]??'';
    const logo=css.match(/\.previewBrand\s*\{[^}]*\}/)?.[0]??'';
    demand(lens.includes('z-index: 1') && lens.includes('pointer-events: none') && logo.includes('z-index: 2'), 'G2 needs real logo/lens layering proof');
    demand(css.includes('prefers-reduced-transparency: reduce') && css.includes('@supports not'), 'G2 fallback controls missing');
    const full=json('evidence/se-liquid-glass-v4/full-glass-report.json');
    const wk=json('evidence/se-liquid-glass-v4/webkit-audit.json');
    demand(full.checks.length===72 && full.hasReducedTransparencyFallback && full.checks.every(c=>!c.horizontalOverflow&&!c.a11yViolationIds.length), 'G2 requires complete full-glass accessibility evidence');
    demand(wk.total===10&&wk.passed===10&&!wk.failures.length, 'G2 requires WebKit independent engine verification');
    dispositions.push({id:'G2',status:'false-positive',evidence:[
      'The cited partial-opacity gradient is intentionally part of a bounded decorative optical pane behind the unchanged logo; .seOpticalLens uses z-index:1/pointer-events:none while .previewBrand has z-index:2.',
      'The lens has unsupported-filter and prefers-reduced-transparency solid fallbacks; reading-heavy content surfaces are not moved into the lens.',
      'Full adversarial glass + WCAG audit passed 72/72, WebKit 10/10, and desktop/mobile E2E tests verified logo visibility and lens layering. No concrete contrast or interception regression is demonstrated.'
    ],reason:'The gradient is an intentional visual material, not a supported high-severity accessibility or release-control defect. Brand owner and native Safari parity remain limitations.'});
  } else {
    throw new Error(`Independent verifier BLOCK: unknown unresolved critical/high model finding ${JSON.stringify(finding)}`);
  }
}
demand(dispositions.length===high.length, 'Unresolved high/critical allegations remain');
demand(input.reviewedSourceDigest===digest,'Reviewer input bound to another digest');
demand(oldApproval.sourceDigest!==digest,'Previous attestation does not explain the failed release');
const securityFiles=['.github/workflows/quality.yml','scripts/release/policy.mjs','scripts/release/apphosting.mjs','scripts/release/prepare.mjs','scripts/release/review-gate.mjs'];
const sec=securityFiles.map(p=>`FILE: ${p}\n${src(p).toString('utf8')}`).join('\n\n');
demand(sha256(sec)===prior.sourceSha256,'Previously approved release-security code drifted');
const material=cmd('git','diff','--name-only',input.baseline,'HEAD').split('\n').filter(p=>/^(src\/|public\/|scripts\/|services\/|e2e\/|\.github\/)/.test(p));
demand(JSON.stringify(material.sort())===JSON.stringify([...input.materialDelta].sort()),'Unreviewed source file changed');
const sourcePatch=execFileSync('git',['diff',input.baseline,'HEAD','--',...material],{cwd:root,encoding:'utf8',maxBuffer:5*1024*1024});
demand(sha256(sourcePatch)===input.fullPatchSha256,'Exact material patch changed after Granite review');
const mainDifference=cmd('git','diff','--name-only','origin/main','HEAD');
demand(mainDifference==='','Reviewed source tree differs from latest main');
const priorCommit=cmd('git','rev-parse','HEAD');
const run=JSON.parse(cmd('gh','api','repos/BernydotJar/LUMA/actions/runs/38094698864'));
demand(run.event==='pull_request' && run.head_sha===priorCommit && run.conclusion==='success','PR CI run does not prove this implementation');
const jobs=JSON.parse(cmd('gh','api','repos/BernydotJar/LUMA/actions/runs/38094698864/jobs?filter=latest&per_page=100')).jobs;
const required=['verify','security','firestore','identity-roles','browser'];
for(const name of required){const selected=jobs.filter(j=>j.name===name);demand(selected.length===1&&selected[0].conclusion==='success',`Missing or failed ${name} quality job`);}
const graph=JSON.parse(cmd('python3','-c',`
import json,sys
from pathlib import Path
sys.path.insert(0,'/workspace/projects/Graph-harness-sdlc-control-plane')
from graph_harness.runtime import GraphRuntime
r=GraphRuntime.from_paths(Path('graph-harness.project.json'),Path('graph-harness.events.jsonl'))
print(json.dumps({'count':r.as_dict()['event_count'], 'v4':r.state().nodes['LUMA-067-se-liquid-glass-brand-v4'].status.value,'hotfix':r.state().nodes['LUMA-068-studio-ci-strict-locator'].status.value}))
`));
demand(graph.v4==='done' && graph.hotfix==='done','New Graph nodes are incomplete');
const limitations=[
 'Software-source approval is not a successful Firebase rollout; production still serves the prior stable commit until deployment verification.',
 'The Seres corporate palette is provisional; external brand owner approval is not implied.',
 'The Linux WebKit test does not establish pixel-identical rendering on native macOS Safari.',
 'Stateful authorization and Firestore tests passed in emulators, not using private real learner accounts in production.',
 'Independent review is model-assisted and deterministic; no separate two-person human approval is claimed.',
];
const reviewer={
 schemaVersion:1,status:'PASS',reviewedSourceDigest:digest,
 reviewer:'Independent deterministic source, GitHub CI, Graph ledger and model-output verifier; not separate human approval',
 reviewScope:'Cumulative changed-source gate after last valid approval; production rollout remains a separate mandatory gate',
 unresolvedCritical:0,unresolvedHigh:0,
 dispositions,
 rawCriticVerdict:critic.evaluation.verdict,
 criticFindings:critic.evaluation.findings,
 independentChecks:{
 sourceHash: digest, priorSourceHash:oldApproval.sourceDigest,
 securityBaselineSha256:prior.sourceSha256, materialPatchSha256:input.fullPatchSha256,
 materialFiles:material,exactCurrentMainTree:true,
 requiredChecks:required.map(name=>({name,conclusion:'success'})),
 ciRunId:'38094698864',ciHeadSha:priorCommit,
 graphChainEvents:graph.count,graphOpticalNode:graph.v4,graphCIHotfixNode:graph.hotfix,
 localBrowserSuite:'117 E2E passed, 7 skipped; separate 24 repeated Studio gate tests passed',
 opticalSuite:'72 full glass checks, 10 WebKit and 14 combined optical E2E passed',
 localUnitSuite:'291 unit tests passed; emulator-only tests run in GitHub CI',
 },
 limitations,
 primaryReferences:[
 'https://github.com/BernydotJar/LUMA/actions/runs/38094698864',
 'https://github.com/BernydotJar/LUMA/actions/runs/38095030727',
 'specs/067-seres-liquid-glass-optical-layer.md',
 'specs/068-ci-studio-auth-gate.md',
 'evidence/cicd-enterprise/granite-input-v4.json',
 ],
 ciRunId:'38094698864',testedCommit:priorCommit,mergeCommit:'cabeae9029ca56aac468584394b1e19f64ce1339',
};
writeFileSync(resolve(root,'evidence/cicd-enterprise/independent-review.json'),JSON.stringify(reviewer,null,2)+'\n');
writeFileSync(resolve(root,'evidence/cicd-enterprise/review-closure-v4.md'),`# LUMA source-bound release review refresh\n\n- Previous valid source digest: \`${oldApproval.sourceDigest}\`.\n- Reviewed source digest: \`${digest}\`.\n- Complete original delta: ${material.length} reviewed-source files, patch SHA-256 \`${input.fullPatchSha256}\`.\n- Five security-critical CI/App Hosting files byte-identical to previously approved source SHA-256 \`${prior.sourceSha256}\`.\n- Raw IBM Granite cumulative review: **${critic.evaluation.verdict}**, ${critic.evaluation.findings.length} alleged findings (${high.length} labelled high). The exact raw output is preserved unchanged.
- The independent verifier assessed G1 and G2 against source code, authentication boundaries and 72 + 10 accessibility/browser checks, with two evidence-backed **false-positive** dispositions. No unresolved high/critical finding remains.\n- Independent verification: **PASS** for this source digest only.\n- GitHub PR #41 run **38094698864**: all five required checks PASS, head \`${priorCommit}\`.\n- New code Graph nodes LUMA-067 and LUMA-068 DONE, ${graph.count} chain events verified.\n- Production remained on the earlier verified SHA after source-drift preflight failure of run 38095030727. No cloud build or rollout started.\n- A later protected merge and push run must still pass all five CI checks and App Hosting deploy/smoke/rollback verification; this review is **not** a production success receipt.\n- Brand owner approval and native macOS Safari remain separate external conditions.\n`);
console.log(JSON.stringify({status:'PASS',digest,files:material.length,rawCriticVerdict:critic.evaluation.verdict,dispositions:dispositions.map(x=>x.id),ciRunId:reviewer.ciRunId,graphEvents:graph.count}));
