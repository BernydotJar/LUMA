import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { invariant } from './policy.mjs';
import { verifyApprovalSignature } from './approval-signature.mjs';
const root = resolve(import.meta.dirname, '../..');
export const hash = value => createHash('sha256').update(value).digest('hex');
export function reviewedSourceDigest(directory = root) {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: directory, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }).split('\0').filter(Boolean);
  const files = [...new Set(paths)].filter(file =>
    /^(src\/|public\/|scripts\/|services\/|e2e\/|\.github\/)/.test(file) ||
    /^(AGENTS\.md|graph-harness\.project\.json|\.gitignore|package(-lock)?\.json|apphosting\.yaml|next\.config\.ts|tsconfig\.json|postcss\.config\.mjs|playwright\.config\.ts|vitest\.config\.ts|eslint\.config\.mjs|firebase\.json|firestore\.(rules|indexes\.json))$/.test(file),
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
  invariant([2,3].includes(attestation?.schemaVersion) && attestation.status === 'PASS',
    'Signed Graph release approval is absent or blocked');
  invariant(/^[a-f0-9]{64}$/.test(digest) && attestation.sourceDigest === digest, 'Source changed since independent review');
  invariant(attestation.unresolvedCritical === 0 && attestation.unresolvedHigh === 0, 'Blocking adversarial findings remain');
  if (attestation.schemaVersion === 3) {
    const review = attestation.review;
    const owner = attestation.ownerAuthorization;
    invariant(review?.method === 'protected-granite-owner-v1' &&
      review.reviewerType === 'automated-model-critic' && review.humanIndependent === false &&
      review.model === 'ibm/granite3.3:2b' &&
      ['PASS','NEEDS_REVIEW'].includes(review.modelVerdict) &&
      Number.isSafeInteger(review.codexReviewCommentId) &&
      (review.modelVerdict === 'PASS' ? review.codexReviewCommentId === 0 : review.codexReviewCommentId > 0) &&
      review.commitSha === attestation.testedCommit &&
      Number.isSafeInteger(review.workflowRunId) && review.workflowRunId > 0 &&
      /^[a-f0-9]{40}$/.test(review.trustedWorkflowCommit ?? '') &&
      /^[a-f0-9]{64}$/.test(review.artifactDigestSha256 ?? '') &&
      /^[a-f0-9]{64}$/.test(review.modelDigest ?? '') &&
      owner?.method === 'github-issue-comment' && owner.login === 'BernydotJar' &&
      owner.humanIndependent === false &&
      Number.isSafeInteger(owner.commentId) && owner.commentId > 0 &&
      owner.commitSha === attestation.testedCommit &&
      ['public-landing','owner-risk-exception'].includes(owner.scope),
      'V3 model review or sole-owner acceptance lacks protected exact-SHA provenance');
  } else {
    invariant(attestation.review?.commitSha === attestation.testedCommit &&
      Number.isSafeInteger(attestation.review?.reviewId) && attestation.review.reviewId > 0,
      'External review provenance is missing or signed for another source SHA');
  }
  invariant(typeof attestation.graphEventId === 'string' && /^[a-f0-9]{64}$/.test(attestation.graphEventHash ?? ''), 'Missing Graph gate receipt');
  for (const item of (attestation.schemaVersion === 3 ? ['critic','verifier','ci'] : ['critic','verifier'])) invariant(/^[a-f0-9]{64}$/.test(attestation[item]?.sha256 ?? ''), `Missing ${item} evidence digest`);
}
export function verifyReview(directory = root) {
  const attestation = JSON.parse(readFileSync(resolve(directory, 'evidence/cicd-enterprise/release-approval.json'), 'utf8'));
  assertReviewAttestation(attestation, reviewedSourceDigest(directory));
  // PR-owned files and Graph hashes are NOT authoritative by themselves.
  // A protected signer must attest the exact source, GitHub run, reviews, and gate.
  verifyApprovalSignature(attestation, process.env.LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64);
  const evidenceFiles = { critic:'evidence/cicd-enterprise/granite-review.json',
    verifier:'evidence/cicd-enterprise/independent-review.json',
    ...(attestation.schemaVersion === 3 ? {ci:'evidence/cicd-enterprise/release-ci.json'} : {}) };
  for (const [kind, path] of Object.entries(evidenceFiles)) {
    invariant(hash(readFileSync(resolve(directory, path))) === attestation[kind].sha256, `${kind} evidence changed after approval`);
    const evidence = JSON.parse(readFileSync(resolve(directory, path), 'utf8'));
    invariant(evidence.reviewedSourceDigest === attestation.sourceDigest, `${kind} reviewed a different source tree`);
    invariant(kind === 'critic' ? evidence.complete === true :
      kind === 'verifier' ? evidence.status === 'PASS' :
      evidence.status === 'TECHNICAL_GATES_PASS_RELEASE_PENDING',
      `${kind} review is incomplete`);
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
assert gate['actor']==('automated-evidence-verifier' if sys.argv[3]=='3' else 'independent-verifier'), 'Wrong gate actor'
if sys.argv[3]=='3':
    assert f'sourceDigest={sys.argv[4]}' in gate['payload'].get('note',''), 'Model Graph gate is not source digest-bound'
    assert f'reviewedCommit={sys.argv[5]}' in gate['payload'].get('note',''), 'Model Graph gate lacks reviewed SHA'
    assert f'modelVerdict={sys.argv[9]}' in gate['payload'].get('note',''), 'Graph gate lacks true Granite model verdict'
assert not any(e['node_id']==gate['node_id'] and e['sequence']>gate['sequence'] and e['event_type'] in ('node.invalidated','failure.recorded') for e in events), 'Release was invalidated'
proofs=[e for e in events if e['event_id'] in gate['payload']['evidence_ids']]
assert {'critic','verification','ci'}.issubset({e['payload'].get('kind') for e in proofs}), 'Required Graph evidence missing'
assert all(e['node_id']==gate['node_id'] and e['node_revision']==gate['node_revision'] and e['payload']['result']=='PASS' for e in proofs), 'Graph evidence is failed or stale'
if sys.argv[3]=='3':
    assert len(proofs)==3, 'V3 Graph must carry exactly critic/verifier/CI evidence'
    expected_sha={'critic':sys.argv[6],'verification':sys.argv[7],'ci':sys.argv[8]}
    for e in proofs:
        data=e['payload']; kind=data['kind']
        assert data['sha256']==expected_sha[kind], 'Graph evidence source hash differs from signed receipt'
        assert data.get('commit')==sys.argv[5], 'Graph evidence references a stale source SHA'
        assert data.get('metadata',{}).get('source_digest')==sys.argv[4], 'Graph evidence source digest is stale'
        assert data.get('metadata',{}).get('human_independent') is False, 'Model gate must not pretend human review'
print(gate['event_hash'])
`, directory, attestation.graphEventId, String(attestation.schemaVersion),
    attestation.sourceDigest, attestation.testedCommit, attestation.critic.sha256,
    attestation.verifier.sha256, attestation.ci?.sha256 ?? '',
    attestation.review?.modelVerdict ?? ''], { encoding: 'utf8' }).trim();
  invariant(proof === attestation.graphEventHash, 'Graph gate digest differs from approval');
  return attestation;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--digest')) console.log(reviewedSourceDigest());
  else { verifyReview(); console.log('Independent Graph release gate and reviewed source verified'); }
}
