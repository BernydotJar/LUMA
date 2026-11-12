/** Verified signed release receipts held outside the candidate Git tree.
 * PR comments serve only as a discovery index. Source SHA, authenticated
 * review, Ed25519 signature, and Graph evidence remain authoritative.
 */
import { execFileSync } from 'node:child_process';
import { invariant } from './policy.mjs';
import { verifyApprovalSignature } from './approval-signature.mjs';

export const ATTESTATION_MARKER='<!-- luma-protected-ed25519-attestation:v2 -->';
export const TRUSTED_PUBLISHER='github-actions[bot]';
export const REPOSITORY='BernydotJar/LUMA';
const SHA40=/^[a-f0-9]{40}$/;
const FENCE=String.fromCharCode(96).repeat(3);
export function receiptCommentBody(prNumber,approval){
  invariant(Number.isSafeInteger(prNumber)&&prNumber>0,'Invalid PR for signed receipt');
  invariant(approval?.schemaVersion===2 && approval?.signature,
    'Only protected signed approvals may be published');
  const envelope={ schemaVersion:1, repository:REPOSITORY,prNumber,
    reviewedHead:approval.testedCommit,approval };
  return ATTESTATION_MARKER+'\n'+FENCE+'json\n'+JSON.stringify(envelope)+'\n'+FENCE;
}
export function parseReceiptComment(comment){
  if(comment?.user?.login!==TRUSTED_PUBLISHER ||
      (comment.performed_via_github_app?.slug &&
       comment.performed_via_github_app.slug!=='github-actions') ||
      typeof comment.body!=='string' || comment.body.length>24000 ||
      !comment.body.startsWith(ATTESTATION_MARKER+'\n'+FENCE+'json\n'))
    return null;
  const rest=comment.body.slice((ATTESTATION_MARKER+'\n'+FENCE+'json\n').length);
  if(!rest.endsWith('\n'+FENCE))return null;
  try { return JSON.parse(rest.slice(0,-(1+FENCE.length))); }catch { return null; }
}
export function selectSignedReceipt(comments,prNumber,head,publicKey){
  invariant(Number.isSafeInteger(prNumber)&&prNumber>0&&SHA40.test(head),
    'Signed receipt lookup requires a real PR and exact head');
  const matching=comments.flatMap(comment=>{
    const envelope=parseReceiptComment(comment);
    if(!envelope||envelope.schemaVersion!==1||envelope.repository!==REPOSITORY ||
       envelope.prNumber!==prNumber || envelope.reviewedHead!==head ||
       envelope.approval?.testedCommit!==head)return [];
    return [{comment,approval:envelope.approval}];
  }).sort((a,b)=>(a.comment.created_at||'').localeCompare(b.comment.created_at||'')||
      a.comment.id-b.comment.id);
  invariant(matching.length>0,'No protected exact-head signed release receipt exists');
  const chosen=matching.at(-1);
  verifyApprovalSignature(chosen.approval,publicKey);
  return {approval:chosen.approval,commentId:chosen.comment.id};
}
export function ghJson(path){
  return JSON.parse(execFileSync('gh',['api',path],{encoding:'utf8',
    timeout:20000,maxBuffer:8*1024*1024}));
}
export function ghPages(path){
  const all=[];
  for(let page=1;page<=50;page++){
    const sep=path.includes('?')?'&':'?';
    const rows=ghJson(path+sep+'page='+page);
    invariant(Array.isArray(rows),'GitHub comments pagination returned invalid JSON');
    all.push(...rows);
    if(rows.length<100)return all;
  }
  throw Error('GitHub signed receipt search exceeded the pagination limit');
}
export function findSignedReceipt(prNumber,head,publicKey){
  const comments=ghPages('repos/'+REPOSITORY+'/issues/'+prNumber+'/comments?per_page=100');
  return selectSignedReceipt(comments,prNumber,head,publicKey);
}
