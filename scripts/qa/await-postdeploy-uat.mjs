#!/usr/bin/env node
/**
 * Wait for a separately authorized workflow_dispatch UAT run STARTED after
 * this exact promotion; do not select historical or PR-generated artifacts.
 * The protected workflow must be manually dispatched by a trusted reviewer.
 */
import { appendFileSync,readFileSync,realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { assertUatProvenance } from './verify-acceptance-artifact.mjs';

const REPO = 'BernydotJar/LUMA';
const REPO_ID = 1403901485;

export function eligibleRun(run,expected){
  const actors=new Set(String(expected.actors||'').split(',')
    .map(name=>name.trim().toLowerCase()).filter(Boolean));
  const started=Date.parse(expected.promotionAt||'');
  const created=Date.parse(run.created_at||'');
  if(!actors.size||!Number.isFinite(started)||!Number.isFinite(created))return false;
  return run.workflow_id===Number(expected.workflowId) &&
    run.path===expected.workflowPath &&
    run.repository?.id===REPO_ID &&
    run.head_repository?.id===REPO_ID &&
    run.head_sha===expected.sha &&
    run.head_branch==='main' &&
    run.event==='workflow_dispatch' &&
    actors.has(run.actor?.login?.toLowerCase()) &&
    actors.has(run.triggering_actor?.login?.toLowerCase()) &&
    created>started;
}

async function github(endpoint,token){
  const res=await fetch('https://api.github.com/repos/'+REPO+'/'+endpoint,{
    headers:{authorization:'Bearer '+token,accept:'application/vnd.github+json',
      'x-github-api-version':'2022-11-28'},
    signal:AbortSignal.timeout(15000),
  });
  if(!res.ok)throw Error('GITHUB_INDEPENDENT_UAT_LOOKUP_HTTP_'+res.status);
  return res.json();
}

async function main(){
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REF!=='refs/heads/main'||
     process.env.GITHUB_REPOSITORY!==REPO)throw Error('PROTECTED_PRODUCTION_ONLY');
  const workflowId=process.env.LUMA_ACCEPTANCE_WORKFLOW_ID;
  const workflowPath=process.env.LUMA_ACCEPTANCE_WORKFLOW_PATH;
  const actors=process.env.LUMA_ACCEPTANCE_TRUSTED_ACTORS;
  const token=process.env.GH_TOKEN;
  if(!/^[0-9]+$/.test(workflowId||'')||!token||
     !(String(workflowPath||'').startsWith('.github/workflows/') && String(workflowPath||'').split('/').length===3 && /^[A-Za-z0-9._-]+[.]ya?ml$/.test(String(workflowPath||'').split('/')[2]))||
     !String(actors||'').trim())throw Error('TRUSTED_UAT_WORKFLOW_OR_ACTORS_MISSING');
  const ledger=JSON.parse(readFileSync(realpathSync(resolve(process.env.RELEASE_DIR,'release-result.json')),'utf8'));
  const promotionAt=ledger.events?.filter(x=>x.phase==='PROMOTION_STARTED').at(-1)?.at;
  if(ledger.gitSha!==process.env.GITHUB_SHA||ledger.runId!==process.env.GITHUB_RUN_ID||
    !ledger.buildId||!promotionAt)throw Error('CURRENT_PROMOTION_LEDGER_MISSING');
  const expected={ workflowId,workflowPath,actors,sha:ledger.gitSha,promotionAt };
  const limit=Date.now()+15*60*1000;
  let lastFailure=null;
  while(Date.now()<limit){
    const runs=await github('actions/workflows/'+workflowId+'/runs?event=workflow_dispatch&branch=main&per_page=100',token);
    const candidates=(runs.workflow_runs||[]).filter(run=>eligibleRun(run,expected))
      .sort((a,b)=>a.id-b.id);
    for(const run of candidates){
      if(run.status!=='completed'||run.conclusion!=='success')continue;
      try{
        const artifacts=await github('actions/runs/'+run.id+'/artifacts?per_page=100',token);
        assertUatProvenance(run,artifacts,{
          runId:run.id,workflowId,workflowPath,trustedActors:actors,
          repo:REPO,sha:ledger.gitSha,promotionAt
        });
        if(!process.env.GITHUB_OUTPUT)throw Error('GITHUB_OUTPUT_MISSING');
        appendFileSync(process.env.GITHUB_OUTPUT,'run_id='+run.id+'\n');
        console.log('POSTDEPLOY_INDEPENDENT_UAT_FOUND',run.id,ledger.gitSha);
        return;
      }catch(e){ lastFailure=e.message; }
    }
    await delay(10000);
  }
  throw Error('POSTDEPLOY_INDEPENDENT_UAT_TIMEOUT_'+String(lastFailure||'NO_AUTHORIZED_POST_PROMOTION_RUN'));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('POSTDEPLOY_UAT_BLOCKED',e.message);process.exitCode=1;});
