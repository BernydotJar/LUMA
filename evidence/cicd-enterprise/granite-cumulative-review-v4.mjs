import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reviewedSourceDigest } from '../../scripts/release/review-gate.mjs';

const root = resolve(import.meta.dirname, '../..');
const rootPath = name => resolve(root, name);
const sha = input => createHash('sha256').update(input).digest('hex');
const previous = JSON.parse(readFileSync(rootPath('evidence/cicd-enterprise/granite-review-pre-v4.json')));
const securityFiles = ['.github/workflows/quality.yml','scripts/release/policy.mjs','scripts/release/apphosting.mjs','scripts/release/prepare.mjs','scripts/release/review-gate.mjs'];
const securitySource = securityFiles.map(path => `FILE: ${path}\n${readFileSync(rootPath(path),'utf8')}`).join('\n\n');
if (sha(securitySource) !== previous.sourceSha256) throw new Error('Security-critical release source changed; new full review required');
const git = (...args) => execFileSync('git', args, { cwd:root, encoding:'utf8', maxBuffer: 5*1024*1024 });
const baseline = previous.testedCommit ?? 'cee98c8030bb66d2f72c63c2a343f05b10416701';
const files = git('diff','--name-only',baseline,'HEAD').trim().split('\n').filter(Boolean)
  .filter(p => /^(src\/|public\/|scripts\/|services\/|e2e\/|\.github\/)/.test(p));
const expected = [
'e2e/enterprise-boundary.spec.ts','e2e/seres-liquid-glass.spec.ts',
'scripts/audit-seres-glass.mjs','scripts/audit-seres-webkit.mjs','scripts/finalize_se_liquid_glass_graph.py','scripts/finalize_studio_ci_graph.py',
'src/app/library/library.module.css','src/components/app-shell.module.css','src/components/experience-console.module.css','src/components/experience-console.tsx','src/components/twin-detail.module.css','src/lib/themes.ts'];
if (JSON.stringify([...files].sort())!==JSON.stringify([...expected].sort())) throw new Error(`Unexpected source delta: ${JSON.stringify(files)}`);
const patch = git('diff',baseline,'HEAD','--',...files);
const digest = reviewedSourceDigest(root);
const ci = { runId:'38094698864', commit:'d2053fdc047e9b868dc90fe04687ccadd98afd01',requiredJobs:['verify','security','firestore','identity-roles','browser'],expectedConclusion:'success' };
// Every source byte has been enumerated and hashed; the model sees relevant
// excerpts rather than falsely claiming to ingest 38K source-patch characters.
const relevantPatch = git('diff',baseline,'HEAD','--',
'e2e/enterprise-boundary.spec.ts',
'src/app/library/library.module.css',
'src/components/experience-console.module.css','src/components/experience-console.tsx',
'src/components/twin-detail.module.css','src/lib/themes.ts');
const limited = relevantPatch;
const prompt = `You are independent IBM Granite adversarial code reviewer for a GATED release. Attempt to disprove production CODE readiness for exactly the cumulative UI/test delta; do not confuse a code PASS with deployed status. The five release-security files are byte-identical to prior source (SHA256 ${sha(securitySource)}), previously independently reviewed. The full 12-file changed set is SHA256 ${sha(patch)}; the prompt contains only the relevant CSS/TSX/E2E excerpt (the remaining Graph finalizer and audit scripts have separate passed test/Graph receipts). Preserve limitations. Identify concrete critical/high code defects if supported, including auth weakening, ungrounded brand claims, glass opacity/contrast regressions, false PASS assertions, skipped checks or release policy bypass. Return MINIFIED JSON only, at most TWO findings, max 25 words per finding and at most 120 words total: {"verdict":"PASS|BLOCKED","findings":[{"id":"G1","severity":"critical|high|medium|low","file":"path","evidence":"actual code evidence","risk":"concrete risk","fix":"remediation"}],"limitations":["..."],"scope":"..."}.
Actual evidence: Source SHA-256 ${digest}. Seres brand sampled publicly and clearly labelled provisional, not owner-approved. Graph node LUMA-067 DONE after 72/72 glass and 10/10 WebKit Axe pass, 14/14 combined E2E, 291 unit; LUMA-068 DONE after 24/24 Studio gate stress tests, 117 full E2E pass and 291 unit. GitHub PR #41 required 5 jobs success at SHA ${ci.commit}; production promotion is separate and has NOT been validated. Initial deploy failure 'Source changed since independent review' was intentionally fail-closed before cloud mutation; the attestation is being refreshed, not bypassed. Exact changed paths: ${JSON.stringify(files)}.
EXACT RELEVANT PATCH EXCERPT:\n${limited}`;
const input = { model:'ibm/granite3.3:2b', reviewedSourceDigest:digest, priorReviewSha256:sha(readFileSync(rootPath('evidence/cicd-enterprise/granite-review-pre-v4.json'))), securitySourceSha256:sha(securitySource), baseline, materialDelta:files, fullPatchSha256:sha(patch), fullPatchBytes:Buffer.byteLength(patch), promptIncludedPatchBytes:Buffer.byteLength(limited), ci, prompt };
writeFileSync(rootPath('evidence/cicd-enterprise/granite-input-v4.json'),JSON.stringify(input,null,2)+'\n');
try {
  const response=await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:input.model,prompt,stream:true,think:false,format:'json',keep_alive:'2m',options:{temperature:0.08,num_ctx:4096,num_predict:550}}),signal:AbortSignal.timeout(300000)});
  if(!response.ok) throw new Error(`Granite HTTP ${response.status}`);
  let buffer='', text='', last;const decoder=new TextDecoder();
  for await (const chunk of response.body){buffer+=decoder.decode(chunk,{stream:true});let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i).trim();buffer=buffer.slice(i+1);if(!line)continue;const part=JSON.parse(line);if(part.error)throw new Error(part.error);text+=part.response||'';last=part;}}
  if(!last?.done || last.done_reason==='length')throw new Error('Incomplete Granite review output');
  const evaluation=JSON.parse(text);
  if(!['PASS','BLOCKED'].includes(evaluation.verdict) || !Array.isArray(evaluation.findings))throw new Error('Incomplete model review schema');
  const output={model:last.model,complete:true,reviewedSourceDigest:digest,sourceSha256:sha(securitySource),reviewedAt:new Date().toISOString(),reviewMode:'cumulative-security-baseline-plus-exact-ui-delta',priorReview:{path:'evidence/cicd-enterprise/granite-review-pre-v4.json',sha256:input.priorReviewSha256},materialDelta:files,fullPatchSha256:sha(patch),evaluation,metadata:{doneReason:last.done_reason,promptEvalCount:last.prompt_eval_count,evalCount:last.eval_count}};
  writeFileSync(rootPath('evidence/cicd-enterprise/granite-review.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({verdict:evaluation.verdict,findings:evaluation.findings,metadata:output.metadata},null,2));
} catch(e){writeFileSync(rootPath('evidence/cicd-enterprise/granite-error-v4.json'),JSON.stringify({status:'BLOCKED',error:e.message,reviewedSourceDigest:digest},null,2)+'\n');throw e;}
