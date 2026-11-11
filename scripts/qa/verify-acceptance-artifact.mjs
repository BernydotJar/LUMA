#!/usr/bin/env node
/**
 * Validate an independently generated GitHub Actions UAT proof package.
 * No PR-controlled run, fork, actor, historical artifact or unverified run
 * can become customer evidence simply by matching a file name.
 */
import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPOSITORY='BernydotJar/LUMA';
const REPOSITORY_ID=1403901485;
const NAME='luma-acceptance-private-evidence';

export function assertUatProvenance(run,artifacts,expected){
  const id=Number(expected.runId);
  const workflowId=Number(expected.workflowId);
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(workflowId)||workflowId<=0)
    throw Error('NO_PROTECTED_UAT_RUN_OR_TRUSTED_WORKFLOW_ID');
  const actors=new Set(String(expected.trustedActors||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
  if(!actors.size)throw Error('NO_TRUSTED_UAT_ACTORS_CONFIGURED');
  const digest=/^[a-f0-9]{40}$/;
  if(!digest.test(expected.sha)||expected.repo!==REPOSITORY)throw Error('INVALID_RELEASE_SOURCE');
  if(!/^\.github\/workflows\/[a-zA-Z0-9._-]+\.ya?ml$/.test(expected.workflowPath||''))
    throw Error('PROTECTED_UAT_WORKFLOW_PATH_REQUIRED');
  if(run.path!==expected.workflowPath||
    run.id!==id||run.workflow_id!==workflowId||run.repository?.id!==REPOSITORY_ID||
    run.repository?.full_name!==REPOSITORY||run.head_repository?.id!==REPOSITORY_ID||
    run.head_sha!==expected.sha||run.head_branch!=='main'||
    run.event!=='workflow_dispatch'||run.status!=='completed'||run.conclusion!=='success'||
    !actors.has(run.actor?.login?.toLowerCase())||
    !actors.has(run.triggering_actor?.login?.toLowerCase()))
    throw Error('UAT_RUN_PROVENANCE_INVALID_OR_UNTRUSTED');
  const artifact=(artifacts.artifacts??[]).filter(item=>item.name===NAME);
  if(artifact.length!==1||artifact[0].expired!==false||
    !Number.isSafeInteger(artifact[0].size_in_bytes)||artifact[0].size_in_bytes<=0||
    artifact[0].workflow_run?.id!==id||
    artifact[0].workflow_run?.head_sha!==expected.sha)
    throw Error('UAT_ARTIFACT_PROVENANCE_INVALID');
  if(expected.promotionAt){
    const start=Date.parse(expected.promotionAt), created=Date.parse(run.created_at);
    const artifactAt=Date.parse(artifact[0].created_at);
    if(!Number.isFinite(start)||!Number.isFinite(created)||!Number.isFinite(artifactAt)||
       created<=start||artifactAt<=start)
      throw Error('POSTDEPLOY_UAT_PRECEDES_CURRENT_PROMOTION');
  }
  return {runId:id,artifactId:artifact[0].id,headSha:run.head_sha};
}

async function github(path,token){
  const response=await fetch('https://api.github.com/repos/'+REPOSITORY+'/'+path,{
    headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28'},
    signal:AbortSignal.timeout(20000),
  });
  if(!response.ok)throw Error('GITHUB_UAT_PROVENANCE_HTTP_'+response.status);
  return response.json();
}
async function main(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/main')
    throw Error('PROTECTED_MAIN_ACTIONS_REQUIRED');
  const releaseDir=process.env.RELEASE_DIR;
  let promotionAt=null;
  if(process.env.LUMA_ACCEPTANCE_POSTDEPLOY==='true'){
    const ledger=JSON.parse(readFileSync(realpathSync(resolve(releaseDir,'release-result.json')),'utf8'));
    if(ledger.gitSha!==process.env.GITHUB_SHA||ledger.runId!==process.env.GITHUB_RUN_ID||
       !ledger.buildId)throw Error('PROMOTION_LEDGER_NOT_BOUND_TO_RUN');
    promotionAt=ledger.events?.findLast(x=>x.phase==='PROMOTION_STARTED')?.at;
    if(!promotionAt)throw Error('CURRENT_PROMOTION_NOT_OBSERVED');
  }
  const trusted={
    runId:process.env.LUMA_ACCEPTANCE_ARTIFACT_RUN_ID,
    workflowId:process.env.LUMA_ACCEPTANCE_WORKFLOW_ID,
    workflowPath:process.env.LUMA_ACCEPTANCE_WORKFLOW_PATH,
    trustedActors:process.env.LUMA_ACCEPTANCE_TRUSTED_ACTORS,
    repo:process.env.GITHUB_REPOSITORY,sha:process.env.GITHUB_SHA,promotionAt,
  };
  const token=process.env.GH_TOKEN;
  if(!token)throw Error('GITHUB_PROVENANCE_READ_TOKEN_REQUIRED');
  const [run,artifacts]=await Promise.all([
    github('actions/runs/'+trusted.runId,token),
    github('actions/runs/'+trusted.runId+'/artifacts?per_page=100',token)
  ]);
  const verified=assertUatProvenance(run,artifacts,trusted);
  if(!process.env.GITHUB_ENV||!process.env.GITHUB_OUTPUT)
    throw Error('PROTECTED_GITHUB_RUNNER_FILES_REQUIRED');
  appendFileSync(process.env.GITHUB_ENV,'LUMA_ACCEPTANCE_VERIFIED_ARTIFACT_RUN_ID='+verified.runId+'\n');
  appendFileSync(process.env.GITHUB_OUTPUT,'run_id='+verified.runId+'\n');
  console.log('INDEPENDENT_UAT_RUN_PROVENANCE_VERIFIED',{...verified,reviewActor:run.actor.login});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('UAT_PROVENANCE_BLOCKED',e.message);process.exitCode=1;});
