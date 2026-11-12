/** Source-bound PR and main release readiness. Never self-approves a review. */
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { reviewedSourceDigest, verifyReview } from './review-gate.mjs';
import { verifyCurrentIndependentReview } from './live-review-check.mjs';
import { findSignedReceipt, assertPolicyBoundReceipt, ghJson, REPOSITORY } from './remote-attestation.mjs';

const root = resolve(import.meta.dirname, '../..');

/** Keep the status machine testable without mocking the GitHub/Firebase runtime. */
export function evaluateReleaseReadiness(directory = root, options = {}) {
  const calculateDigest = options.digest ?? reviewedSourceDigest;
  const verify = options.verify ?? verifyReview;
  let sourceDigest;
  try {
    sourceDigest = calculateDigest(directory);
    const approval = verify(directory);
    if (approval?.sourceDigest !== sourceDigest || approval.status !== 'PASS') {
      throw new Error('Source-bound approval does not match the checked-out release source');
    }
    return {
      status: 'PASS', sourceDigest,
      graphEventId: approval.graphEventId,
      verified: ['exact-source', 'external-ed25519-signature', 'critic-digest', 'verifier-digest', 'append-only-graph-gate'],
    };
  } catch (error) {
    return {
      status: 'BLOCKED', sourceDigest: sourceDigest ?? null,
      reason: error instanceof Error ? error.message : 'Unexpected review verification failure',
    };
  }
}

/** Protected-main workflow must revalidate review revocation with GitHub.
 * An already-signed receipt cannot silently outlive a dismissed approval. */
export function evaluateProtectedSourceReadiness(directory, prNumber, expectedHead, options = {}) {
  const local = evaluateReleaseReadiness(directory, options);
  if (local.status !== 'PASS') return local;
  try {
    const review = (options.liveReview ?? verifyCurrentIndependentReview)(directory, prNumber, expectedHead);
    if (!review || !Number.isSafeInteger(review.reviewId)) throw new Error('No current authenticated reviewer');
    return { ...local, verified: [...local.verified, 'current-github-review'],
      reviewer: { method: review.method, login: review.reviewer, reviewId: review.reviewId } };
  } catch (error) {
    return { ...local, status: 'BLOCKED',
      reason: error instanceof Error ? error.message : 'Independent GitHub approval unavailable' };
  }
}

/** Resolves the exact reviewed SHA, never a candidate's self-asserted commit. */
export function identifyGitHubSource(eventName,event,currentSha){
  if(eventName==='pull_request'){
    const number=event?.pull_request?.number ?? event?.number;
    const head=event?.pull_request?.head?.sha;
    if(!Number.isSafeInteger(number)||number<=0||!/^[a-f0-9]{40}$/.test(head||''))
      throw Error('Authenticated pull request webhook is missing head identity');
    return {prNumber:number,head,allowMerged:false};
  }
  if(eventName==='push'){
    if(event?.ref!=='refs/heads/main'||!/^[a-f0-9]{40}$/.test(currentSha||''))
      throw Error('Only a source-bound protected main push can release');
    // The authenticated GitHub REST association must resolve exactly one
    // merged PR whose merge commit equals this commit.
    const matches=ghJson('repos/'+REPOSITORY+'/commits/'+currentSha+'/pulls')
      .filter(pr=>pr.merged_at&&pr.base?.ref==='main'&&
        pr.merge_commit_sha===currentSha&&/^[a-f0-9]{40}$/.test(pr.head?.sha||''));
    if(matches.length!==1)throw Error('Main commit has no unique reviewed merge PR');
    return {prNumber:matches[0].number,head:matches[0].head.sha,allowMerged:true};
  }
  throw Error('CI release readiness supports only pull_request or protected main push');
}
export function evaluateExternalReadiness(directory,source,options={}){
  const publicKey=options.publicKey??process.env.LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64;
  const signed=(options.loadReceipt??findSignedReceipt)(
    source.prNumber,source.head,publicKey).approval;
  if(signed.testedCommit!==source.head)
    throw Error('External attestation is not bound to the current PR head');
  let expectedPolicySha=options.expectedPolicySha;
  if(!expectedPolicySha){
    const currentMain=ghJson('repos/'+REPOSITORY+'/git/ref/heads/main').object.sha;
    if(source.allowMerged===true){
      if(currentMain!==process.env.GITHUB_SHA)
        throw Error('A newer main commit superseded this release verification');
      const commit=ghJson('repos/'+REPOSITORY+'/commits/'+currentMain);
      expectedPolicySha=commit.parents?.[0]?.sha;
    }else{
      expectedPolicySha=currentMain;
    }
  }
  assertPolicyBoundReceipt(signed,expectedPolicySha);
  const verify=dir=>verifyReview(dir,{approval:signed});
  const liveReview=(dir,number,head)=>verifyCurrentIndependentReview(dir,number,head,{
    approval:signed,allowMerged:source.allowMerged===true,
  });
  return evaluateProtectedSourceReadiness(directory,source.prNumber,source.head,{
    verify,liveReview,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args=process.argv.slice(2);
  const protectedMode=args.length>0;
  let result;
  try{
    if(protectedMode){
      if(args.length!==6||args[0]!=='--candidate'||args[2]!=='--pr'||args[4]!=='--head'||
         !/^[0-9]+$/.test(args[3]))throw Error('Expected --candidate <dir> --pr <number> --head <SHA|empty>');
      const dir=resolve(args[1]), prNumber=Number(args[3]);
      const pr=ghJson('repos/'+REPOSITORY+'/pulls/'+prNumber);
      const head=pr.head?.sha;
      if(!/^[a-f0-9]{40}$/.test(head||'')||
         args[5]&&args[5]!==head||pr.base?.ref!=='main'||pr.state!=='open')
        throw Error('Webhook PR identity changed before protected review');
      const checkoutHead=execFileSync('git',['rev-parse','HEAD'],{cwd:dir,encoding:'utf8'}).trim();
      if(checkoutHead!==head)throw Error('Protected review checkout does not match current PR head');
      result=evaluateExternalReadiness(dir,{prNumber,head,allowMerged:false});
    }else if(process.env.GITHUB_ACTIONS==='true'){
      if(!process.env.GH_TOKEN)throw Error('GitHub API read token required for external approval');
      const payload=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
      const source=identifyGitHubSource(process.env.GITHUB_EVENT_NAME,payload,process.env.GITHUB_SHA);
      const pr=ghJson('repos/'+REPOSITORY+'/pulls/'+source.prNumber);
      if(pr.head?.sha!==source.head)throw Error('GitHub PR head changed since workflow event');
      result=evaluateExternalReadiness(root,source);
    }else{
      result=evaluateReleaseReadiness(root);
    }
  }catch(error){
    result={status:'BLOCKED',reason:error instanceof Error?error.message:'Unexpected protected review error'};
  }
  console.log(JSON.stringify(result));
  if(result.status!=='PASS'){
    console.error('RELEASE_READINESS_BLOCKED: current exact SHA requires a protected external Ed25519 receipt, live independent reviewer and verified Graph evidence.');
    process.exitCode=1;
  }else console.log('SOURCE_BOUND_PR_RELEASE_READINESS_PASS');
}
