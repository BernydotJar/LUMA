import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { reviewedSourceDigest } from '../../scripts/release/review-gate.mjs';
const root = resolve(import.meta.dirname, '../..');
const previousPath = resolve(import.meta.dirname, 'granite-review-v3.json');
const previousBytes = readFileSync(previousPath);
const previous = JSON.parse(previousBytes);
const files = ['.github/workflows/quality.yml', 'scripts/release/policy.mjs', 'scripts/release/apphosting.mjs', 'scripts/release/prepare.mjs', 'scripts/release/review-gate.mjs'];
const source = files.map(path => `FILE: ${path}\n${readFileSync(resolve(root, path), 'utf8')}`).join('\n\n');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(hash(source), previous.sourceSha256, 'The original release-security code changed: a full review is required');
assert.equal(previous.complete, true);
const baseline = '46b6e2ba0fe09a4279d1efd0bb80d1b4a15ab7c9';
const allChanged = execFileSync('git', ['diff', '--name-only', baseline, 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const material = allChanged.filter(path => !path.startsWith('docs/') && !path.startsWith('evidence/'));
assert.deepEqual(material.sort(), ['e2e/showcase.spec.ts', 'src/components/learner-greeting.module.css']);
const diff = execFileSync('git', ['diff', baseline, 'HEAD', '--', ...material], { cwd: root, encoding: 'utf8' });
const deployment = readFileSync(resolve(root, 'scripts/release/apphosting.mjs'), 'utf8');
const verification = deployment.slice(deployment.indexOf('async function github('), deployment.indexOf('async function poll('));
const calls = deployment.split('\n').filter(line => /verifyGitHub|INDEPENDENT_GRAPH|verifyReview/.test(line)).join('\n');
const digest = reviewedSourceDigest(root);
const prompt = `You are IBM Granite, independent adversarial critic. Continue your previous full release-security review without assuming approval. The complete five release-security files are byte-identical to the reviewed baseline (SHA-256 verified by this script). Only two material files changed: the exact CSS/test delta below. Your prior raw verdict and findings are preserved. Re-evaluate the inherited G1 allegation using the actual GitHub API verification code below: identify a concrete bypass if one remains, or explicitly explain why that allegation is unsupported. Review the accessibility delta for test weakening, hiding failures or production risk. Attempt to disprove safety; do not invent defects. Return JSON only {"verdict":"PASS|BLOCKED","findings":[{"id":"G1","severity":"critical|high|medium|low","file":"path","evidence":"actual evidence","risk":"concrete risk","fix":"repair"}],"priorFindingDisposition":{"id":"G1","status":"unresolved|false-positive|resolved","reason":"evidence-based reason"},"limitations":["..."]}. PASS means no unresolved blocking code defect in this cumulative review, NOT that CI or deployment already succeeded. CI and production verification remain separately enforced gates.\nPRIOR RAW REVIEW:\n${JSON.stringify(previous.evaluation)}\nACTUAL VERIFICATION CODE:\n${verification}\nACTUAL CALL SITES:\n${calls}\nEXACT MATERIAL DELTA:\n${diff}`;
writeFileSync(resolve(import.meta.dirname, 'granite-delta-input.json'), JSON.stringify({ baseline, reviewedSourceDigest: digest, priorReviewSha256: hash(previousBytes), unchangedSecuritySourceSha256: hash(source), material, prompt }, null, 2) + '\n');
try {
  const response = await fetch('http://127.0.0.1:11434/api/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'ibm/granite3.3:2b', prompt, stream: true, think: false, format: 'json', keep_alive: '2m', options: { temperature: 0, num_ctx: 6144, num_predict: 900 } }),
    signal: AbortSignal.timeout(600000),
  });
  if (!response.ok) throw new Error(`Granite HTTP ${response.status}`);
  const decoder = new TextDecoder(); let buffer = ''; let text = ''; let last;
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
      if (!line) continue;
      const item = JSON.parse(line);
      if (item.error) throw new Error(item.error);
      text += item.response ?? ''; last = item;
    }
  }
  if (!last?.done || last.done_reason === 'length') throw new Error('Incomplete Granite output');
  const result = { model: last.model, complete: true, reviewedSourceDigest: digest, sourceSha256: hash(source), reviewedAt: new Date().toISOString(), reviewMode: 'cumulative-full-baseline-plus-exact-delta', priorReview: { path: 'evidence/cicd-enterprise/granite-review-v3.json', sha256: hash(previousBytes), baseline }, materialDelta: material, evaluation: JSON.parse(text), metadata: { doneReason: last.done_reason, promptEvalCount: last.prompt_eval_count, evalCount: last.eval_count } };
  writeFileSync(resolve(import.meta.dirname, 'granite-review.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.evaluation, null, 2));
} catch (error) {
  writeFileSync(resolve(import.meta.dirname, 'granite-delta-error.json'), JSON.stringify({ status: 'BLOCKED', error: error.message, reviewedSourceDigest: digest }, null, 2) + '\n');
  throw error;
}
