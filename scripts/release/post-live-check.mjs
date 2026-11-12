/** Authenticated issue_comment re-evaluations must also update the PR HEAD's
 * required check context; issue_comment workflow runs themselves attach to main.
 * No API success may be emitted unless trusted protected-base verification passed.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const COMMIT=/^[a-f0-9]{40}$/;
const REPO='BernydotJar/LUMA';
function check(value,msg){if(!value)throw Error(`SOURCE_ATTESTATION_LIVE_BLOCKED: ${msg}`);}

export function createLiveCheckPayload({sourceSha,prNumber,verified,githubActions,
  repository,eventName,policySha}){
  check(githubActions==='true' && repository===REPO && eventName==='issue_comment',
    'Live source check must run in a trusted GitHub issue-comment workflow');
  check(COMMIT.test(sourceSha??'') && COMMIT.test(policySha??'') &&
    Number.isSafeInteger(prNumber) && prNumber>0,
    'Expected exact PR source, protected policy and numeric PR ID');
  check(typeof verified==='boolean','Validation status must be a boolean');
  return {name:'source-attestation',head_sha:sourceSha,status:'completed',
    conclusion:verified?'success':'failure',
    output:{title:verified?'Verified signed source receipt':'Source receipt rejected',
      summary:`Protected-main live recheck of PR #${prNumber} source SHA ${sourceSha} `+
        `using policy ${policySha}; technical verification ${verified?'PASS':'FAIL'}. `+
        'Granite is a model reviewer, not an independent human.'}};
}

async function main(){
  const env=process.env;
  const number=Number(env.REVIEW_PR_NUMBER);
  const sha=env.REVIEW_PR_SHA;
  const payload=createLiveCheckPayload({sourceSha:sha,prNumber:number,
    verified:env.REVIEW_VERIFIED==='true',githubActions:env.GITHUB_ACTIONS,
    repository:env.GITHUB_REPOSITORY,eventName:env.GITHUB_EVENT_NAME,
    policySha:env.GITHUB_SHA});
  check(typeof env.GH_TOKEN==='string'&&env.GH_TOKEN.length>10,'GitHub token absent');
  const result=await fetch(`https://api.github.com/repos/${REPO}/check-runs`,{
    method:'POST',headers:{Authorization:`Bearer ${env.GH_TOKEN}`,
      Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',
      'Content-Type':'application/json'},body:JSON.stringify(payload),
    signal:AbortSignal.timeout(25000)});
  check(result.ok,`GitHub failed to record live source check on PR head: HTTP ${result.status}`);
  const checkRun=await result.json();
  check(checkRun.name===payload.name && checkRun.head_sha===sha &&
    checkRun.conclusion===payload.conclusion && checkRun.app?.slug==='github-actions',
    'Authenticated check-run readback did not match protected source status');
  console.log(JSON.stringify({status:'RECORDED',checkRunId:checkRun.id,
    headSha:sha,conclusion:payload.conclusion,app:checkRun.app.slug}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
