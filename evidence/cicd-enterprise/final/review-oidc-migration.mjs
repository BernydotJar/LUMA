import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const file = resolve(import.meta.dirname, 'immutable-oidc-migration.json');
const bytes = readFileSync(file);
const migration = JSON.parse(bytes);
const prompt = `Act as IBM Granite, independent adversarial identity-security critic. Attempt to disprove this narrowly scoped WIF operational migration. GitHub's authenticated repository settings report use_default=true, use_immutable_subject=true and the exact sub_claim_prefix below. Its official documentation says repositories created after July 15, 2026 include immutable owner/repository IDs in sub. The first release failed closed before any deployment because a name-only subject was expected. The migration changes ONLY the subject equality to the format returned by GitHub; the other five predicates, mapping, issuer, service-account grants, protected main and five CI checks remain unchanged. The full workflow must rerun and OIDC/cloud/production evidence is not claimed yet. Identify actual trust broadening, wrong repository or environment matching, discarded predicates or other supported critical/high defects. Do not invent issues merely because successful runtime verification is still pending. Return concise JSON {"verdict":"PASS|BLOCKED","findings":[{"id":"O1","severity":"critical|high|medium|low","evidence":"specific evidence","risk":"actual failure","fix":"repair"}],"limitations":["..."]}. PASS means configuration review, not production completion.\n${JSON.stringify(migration)}`;
writeFileSync(resolve(import.meta.dirname, 'granite-oidc-input.json'), JSON.stringify({ prompt, migrationSha256: createHash('sha256').update(bytes).digest('hex') }, null, 2) + '\n');
const response = await fetch('http://127.0.0.1:11434/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'ibm/granite3.3:2b', prompt, stream: true, think: false, format: 'json', keep_alive: '2m', options: { temperature: 0, num_ctx: 4096, num_predict: 650 } }), signal: AbortSignal.timeout(300000) });
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
if (!last?.done || last.done_reason === 'length') throw new Error('Incomplete critic response; no approval');
const result = { model: last.model, complete: true, reviewedAt: new Date().toISOString(), migrationSha256: createHash('sha256').update(bytes).digest('hex'), evaluation: JSON.parse(text), metadata: { doneReason: last.done_reason, promptEvalCount: last.prompt_eval_count, evalCount: last.eval_count } };
writeFileSync(resolve(import.meta.dirname, 'granite-oidc-review.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result.evaluation, null, 2));
