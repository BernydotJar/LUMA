/** Controlled, receipt-only import. Never rewrites executable code or signatures. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { reviewedSourceDigest, verifyReview } from './review-gate.mjs';
import { verifyApprovalSignature } from './approval-signature.mjs';
import { invariant } from './policy.mjs';
const FILES = Object.freeze([
  'graph-harness.events.jsonl',
  'evidence/cicd-enterprise/granite-review.json',
  'evidence/cicd-enterprise/independent-review.json',
  'evidence/cicd-enterprise/release-ci.json',
  'evidence/cicd-enterprise/release-approval.json',
]);
const command=(cwd,...args)=>execFileSync(args[0],args.slice(1),{
  cwd,encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
const sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
export function validateBundleManifest(manifest,files,commit,digest){
  invariant(manifest?.schemaVersion===3 && manifest.status==='SIGNED' &&
    manifest.testedCommit===commit && manifest.sourceDigest===digest,
    'Sealed release bundle targets a different frozen source');
  invariant(Object.keys(manifest.files??{}).length===FILES.length &&
    FILES.every(path=>manifest.files[path]===files[path] &&
      /^[a-f0-9]{64}$/.test(files[path]??'')),
    'Release bundle has missing, changed or unexpected files');
  return true;
}
export function importSignedReleaseBundle(directory,bundle){
  const work=resolve(directory), folder=resolve(bundle);
  invariant(command(work,'git','status','--porcelain')==='',
    'Working tree must be completely clean before importing a protected release');
  const commit=command(work,'git','rev-parse','HEAD');
  const digest=reviewedSourceDigest(work);
  const manifest=JSON.parse(readFileSync(join(folder,'manifest.json'),'utf8'));
  const sourceFiles={};
  for(const path of FILES){
    const from=join(folder,path),to=join(work,path);
    invariant(lstatSync(from).isFile() && lstatSync(to).isFile(),
      `Protected release receipt path must be a regular file: ${path}`);
    sourceFiles[path]=sha(from);
  }
  validateBundleManifest(manifest,sourceFiles,commit,digest);
  const approval=JSON.parse(readFileSync(join(folder,
    'evidence/cicd-enterprise/release-approval.json'),'utf8'));
  invariant(approval.testedCommit===commit && approval.sourceDigest===digest &&
    approval.schemaVersion===3,
    'Signed model/owner approval targets a different source');
  verifyApprovalSignature(approval,process.env.LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64);
  for(const path of FILES) writeFileSync(join(work,path),readFileSync(join(folder,path)));
  invariant(reviewedSourceDigest(work)===digest,'Receipt import changed executable source');
  verifyReview(work); // Graph hash chain, source, critic, verifier, signed CI.
  const delta=command(work,'git','diff','--name-only').split('\n').filter(Boolean);
  invariant(delta.length===FILES.length && FILES.every(f=>delta.includes(f)),
    'Import would modify anything beyond the five signed evidence files');
  command(work,'git','diff','--check');
  console.log(JSON.stringify({status:'VALIDATED_RECEIPT_ONLY_IMPORT',reviewedCommit:commit,
    sourceDigest:digest,modifiedEvidenceFiles:delta,ownerCommentId:approval.ownerAuthorization.commentId}));
  return {commit,sourceDigest:digest,files:delta};
}
if(process.argv[1]?.endsWith('/import-solo-bundle.mjs')){
  const [target,bundle]=process.argv.slice(2);
  if(!target||!bundle){console.error('Expected <candidate-worktree> <protected-bundle-dir>');process.exit(2);}
  importSignedReleaseBundle(target,bundle);
}
