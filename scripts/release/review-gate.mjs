import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { invariant } from './policy.mjs';
const root = resolve(import.meta.dirname, '../..');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function reviewedSourceDigest(directory = root) {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: directory, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).split('\0').filter(Boolean);
  const files = [...new Set(paths)].filter(file =>
    /^(src\/|public\/|scripts\/|e2e\/|\.github\/)/.test(file) ||
    /^(package(-lock)?\.json|apphosting\.yaml|next\.config\.ts|tsconfig\.json|postcss\.config\.mjs|playwright\.config\.ts|vitest\.config\.ts|eslint\.config\.mjs|firebase\.json|firestore\.(rules|indexes\.json))$/.test(file),
  ).filter(file => file !== 'src/generated/release-manifest.json').sort();
  invariant(files.length > 0, 'No reviewed source files found');
  const digest = createHash('sha256');
  for (const file of files) {
    invariant(lstatSync(resolve(directory, file)).isFile(), `Non-regular release input: ${file}`);
    digest.update(file).update('\0').update(readFileSync(resolve(directory, file))).update('\0');
  }
  return digest.digest('hex');
}
export function assertReviewAttestation(attestation, digest) {
  invariant(attestation?.schemaVersion === 1 && attestation.status === 'PASS', 'Independent Graph release approval is absent or blocked');
  invariant(/^[a-f0-9]{64}$/.test(digest) && attestation.sourceDigest === digest, 'Source changed since independent review');
  invariant(attestation.unresolvedCritical === 0 && attestation.unresolvedHigh === 0, 'Blocking adversarial findings remain');
  invariant(typeof attestation.graphEventId === 'string' && /^[a-f0-9]{64}$/.test(attestation.graphEventHash ?? ''), 'Missing Graph gate receipt');
  for (const item of ['critic', 'verifier']) invariant(/^[a-f0-9]{64}$/.test(attestation[item]?.sha256 ?? ''), `Missing ${item} evidence digest`);
}
export function verifyReview(directory = root) {
  const attestation = JSON.parse(readFileSync(resolve(directory, 'evidence/cicd-enterprise/release-approval.json'), 'utf8'));
  assertReviewAttestation(attestation, reviewedSourceDigest(directory));
  for (const [kind, path] of Object.entries({ critic: 'evidence/cicd-enterprise/granite-review.json', verifier: 'evidence/cicd-enterprise/independent-review.json' })) {
    invariant(hash(readFileSync(resolve(directory, path))) === attestation[kind].sha256, `${kind} evidence changed after approval`);
    const evidence = JSON.parse(readFileSync(resolve(directory, path), 'utf8'));
    invariant(evidence.reviewedSourceDigest === attestation.sourceDigest, `${kind} reviewed a different source tree`);
    invariant(kind === 'critic' ? evidence.complete === true : evidence.status === 'PASS', `${kind} review is incomplete`);
  }
  // Read-only verification of the existing Graph Harness event format. All event
  // creation remains delegated to GraphRuntime/EventStore; hashes are never repaired.
  const proof = execFileSync('python3', ['-c', `
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1]); expected=sys.argv[2]; previous='0'*64; events=[]
for line in (root/'graph-harness.events.jsonl').read_text().splitlines():
    if not line.strip(): continue
    event=json.loads(line)
    assert event['sequence']==len(events)+1 and event['previous_event_hash']==previous, 'Graph chain ordering failure'
    material=dict(event); material['event_hash']=''
    actual=hashlib.sha256(json.dumps(material,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    assert actual==event['event_hash'], 'Graph hash mismatch'
    previous=actual; events.append(event)
gates=[e for e in events if e['node_id']=='LUMA-CICD-002-release-pipeline' and e['event_type']=='gate.evaluated' and e['payload']['gate_id']=='cicd-release']
assert gates and gates[-1]['event_id']==expected and gates[-1]['payload']['result']=='PASS', 'Release gate is missing, stale or blocked'
gate=gates[-1]
assert gate['actor']=='independent-verifier', 'Wrong gate actor'
assert not any(e['node_id']==gate['node_id'] and e['sequence']>gate['sequence'] and e['event_type'] in ('node.invalidated','failure.recorded') for e in events), 'Release was invalidated'
proofs=[e for e in events if e['event_id'] in gate['payload']['evidence_ids']]
assert {'critic','verification','ci'}.issubset({e['payload'].get('kind') for e in proofs}), 'Required Graph evidence missing'
assert all(e['node_id']==gate['node_id'] and e['node_revision']==gate['node_revision'] and e['payload']['result']=='PASS' for e in proofs), 'Graph evidence is failed or stale'
print(gate['event_hash'])
`, directory, attestation.graphEventId], { encoding: 'utf8' }).trim();
  invariant(proof === attestation.graphEventHash, 'Graph gate digest differs from approval');
  return attestation;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--digest')) console.log(reviewedSourceDigest());
  else { verifyReview(); console.log('Independent Graph release gate and reviewed source verified'); }
}
