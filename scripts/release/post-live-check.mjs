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
  repository,eventName,policySha,phase='finish'}){
  check(githubActions==='true'&&repository===REPO&&eventName==='issue_comment',
    'Live check must run in trusted GitHub issue-comment workflow');
  check(COMMIT.test(sourceSha??'')&&COMMIT.test(policySha??'')&&
    Number.isSafeInteger(prNumber)&&prNumber>0,'Invalid exact PR SHA or protected policy');
  check(['start','finish'].includes(phase),'Unsupported live check phase');
  check(phase==='start'?verified===undefined:typeof verified==='boolean',
    'Live check lifecycle status inconsistent');
  const summary='Protected-main recheck of PR '+prNumber+' SHA '+sourceSha+
    ' using policy '+policySha+'; state '+(phase==='start'?'IN_PROGRESS':
      verified?'PASS':'FAIL')+'. Model review is not independent human approval.';
  const obj={name:'source-attestation',head_sha:sourceSha,
    status:phase==='start'?'in_progress':'completed',
    output:{title:phase==='start'?'Validating source receipt':
      verified?'Verified signed source receipt':'Source receipt rejected',summary}};
  if(phase==='finish')obj.conclusion=verified?'success':'failure';
  return obj;
}
async function githubCall(method,url,body,token){
  const response=await fetch(url,{method,headers:{
    Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
    body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  check(response.ok,'GitHub check lifecycle request failed: '+response.status);
  return response.json();
}
async function main(){
  const env=process.env,phase=process.argv[2],sha=env.REVIEW_PR_SHA;
  check(phase==='start'||phase==='finish','Explicit start/finish phase required');
  const payload=createLiveCheckPayload({sourceSha:sha,prNumber:Number(env.REVIEW_PR_NUMBER),
    ...(phase==='finish'?{verified:env.REVIEW_VERIFIED==='true'}:{}),
    githubActions:env.GITHUB_ACTIONS,repository:env.GITHUB_REPOSITORY,
    eventName:env.GITHUB_EVENT_NAME,policySha:env.GITHUB_SHA,phase});
  check(typeof env.GH_TOKEN==='string'&&env.GH_TOKEN.length>10,'GitHub token missing');
  let result;
  if(phase==='start'){
    result=await githubCall('POST','https://api.github.com/repos/'+REPO+'/check-runs',
      payload,env.GH_TOKEN);
    check(Number.isSafeInteger(result.id)&&result.id>0&&result.name===payload.name&&
      result.head_sha===sha&&result.status==='in_progress'&&
      result.app?.slug==='github-actions','Created pending check lacks provenance');
    check(typeof env.GITHUB_OUTPUT==='string'&&env.GITHUB_OUTPUT.length>0,
      'GitHub output channel missing');
    const {appendFileSync}=await import('node:fs');
    appendFileSync(env.GITHUB_OUTPUT,'id='+result.id+'\n');
  }else{
    const id=Number(env.REVIEW_CHECK_RUN_ID);
    check(Number.isSafeInteger(id)&&id>0,'Missing original pending check ID');
    const original=await fetch('https://api.github.com/repos/'+REPO+'/check-runs/'+id,{
      headers:{Authorization:'Bearer '+env.GH_TOKEN,Accept:'application/vnd.github+json'},
      signal:AbortSignal.timeout(25000)});
    check(original.ok,'Pending check cannot be authenticated');
    const prior=await original.json();
    check(prior.status==='in_progress'&&prior.name===payload.name&&
      prior.head_sha===sha&&prior.app?.slug==='github-actions',
      'Original check SHA, identity or pending state changed');
    result=await githubCall('PATCH','https://api.github.com/repos/'+REPO+'/check-runs/'+id,
      {status:payload.status,conclusion:payload.conclusion,output:payload.output},
      env.GH_TOKEN);
    check(result.id===id&&result.name===payload.name&&result.head_sha===sha&&
      result.status==='completed'&&result.conclusion===payload.conclusion&&
      result.app?.slug==='github-actions','Check completion readback mismatch');
  }
  console.log(JSON.stringify({status:phase==='start'?'PENDING':'RECORDED',
    checkRunId:result.id,headSha:sha,conclusion:result.conclusion??null,
    app:result.app.slug}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
