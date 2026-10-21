/**
 * QA-only bridge from already-approved LiveKit CLI credentials to ephemeral
 * provider test. Never serializes credentials, raw tokens or source config.
 */
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require=createRequire(import.meta.url);
const yaml=require('js-yaml');

const configPath=process.env.LUMA_QA_CLI_CONFIG_PATH ||
 '/opt/luma-livekit-qa/privatehome/.livekit/cli-config.yaml';
const expectedId='p_5650huuc5om';
const expectedHost='luma-0x6n7955.livekit.cloud';
const mode=process.env.LUMA_CLOUD_QA_ALLOWED;
if (!['provider-only','provider-revoke-before-close','provider-post-settings','provider-departed'].includes(mode)) {
 throw new Error('Denied: explicit provider-only or provider-revoke-before-close mode required');
}
const meta=fs.statSync(configPath);
if ((meta.mode & 0o077)!==0) {
 throw new Error('Denied: CLI credentials must be accessible only to the owner');
}
const config=yaml.load(fs.readFileSync(configPath,'utf8'));
const projects=Array.isArray(config.projects)?config.projects:Object.values(config.projects||{});
const project=projects.find(p=>p.project_id===expectedId);
if (!project || new URL(project.url).hostname!==expectedHost ||
    !project.api_key || !project.api_secret) {
 throw new Error('Denied: expected LUMA Cloud project ID, endpoint and credentials not found');
}
const alternate=mode==='provider-revoke-before-close';
const postSetting=mode==='provider-post-settings';
const departedSetting=mode==='provider-departed';
const testFile=departedSetting
 ? 'scripts/qa/livekit-cloud-departed-learner-20261021.mjs'
 : postSetting
 ? 'scripts/qa/livekit-cloud-post-settings-20261021.mjs'
 : alternate
   ? 'scripts/qa/livekit-cloud-revoke-before-close.mjs'
   : 'scripts/qa/livekit-cloud-enterprise-gate.mjs';
const target='evidence/live-classroom-acceptance/'+
 (departedSetting?'cloud-departed-learner-20261021':postSetting?'cloud-post-setting-20261021':alternate
 ?'cloud-revoke-before-close-qa-20261020':'cloud-provider-qa-20261020');
mkdirSync(target,{recursive:true});
const stdout=fs.createWriteStream(target+'/execution.log',{flags:'w',mode:0o600});
const env={...process.env,
 LIVEKIT_CLOUD_TEST_URL:project.url,
 LIVEKIT_CLOUD_TEST_API_KEY:project.api_key,
 LIVEKIT_CLOUD_TEST_API_SECRET:project.api_secret,
 PLAYWRIGHT_BROWSERS_PATH:'/usr/bin'
};
// Every run invalidates prior mutable reports BEFORE starting the child.
const source=departedSetting
 ? 'evidence/live-classroom-acceptance/cloud-departed-learner-20261021/cloud-provider-verification.json'
 : postSetting
 ? 'evidence/live-classroom-acceptance/cloud-post-setting-20261021/cloud-provider-verification.json'
 : alternate
   ? 'evidence/live-classroom-acceptance/cloud-revoke-before-close-verification.json'
   : 'evidence/live-classroom-acceptance/cloud-enterprise-verification.json';
for(const stale of [source,target+'/cloud-provider-result.json',target+'/status.json']){
 fs.rmSync(stale,{force:true});
}
const runStartedAt=Date.now();
const child=spawn(process.execPath,[testFile],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
function redact(x) {
 return x.replaceAll(project.api_secret,'[SECRET_REDACTED]')
  .replaceAll(project.api_key,'[KEY_REDACTED]')
  .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g,'[JWT_REDACTED]');
}
let carry='';
function capture(data) {
 const next=carry+data.toString('utf8');
 // Hold back up to a full raw credential so a secret split across chunks
 // cannot be revealed as two unredacted fragments.
 const remain=Math.max(project.api_secret.length,project.api_key.length)+80;
 if(next.length<=remain){carry=next;return;}
 stdout.write(redact(next.slice(0,next.length-remain)));
 carry=next.slice(-remain);
}
child.stdout.on('data',capture);
child.stderr.on('data',capture);
child.on('error',err=>{stdout.write('RUNNER_SPAWN_FAILURE '+err.name+'\n');});
const result=await new Promise(resolve=>child.on('close',code=>resolve(code)));
stdout.write(redact(carry));stdout.end();
let summary={decision:'NO_RESULT',checks:[],projectId:expectedId};
try {
 const stat=fs.statSync(source);
 if(stat.mtimeMs < runStartedAt-1000)throw new Error('STALE_CLOUD_QA_EVIDENCE');
 const r=JSON.parse(fs.readFileSync(source,'utf8'));
 if(!Array.isArray(r.checks)||!r.checks.length)throw new Error('EMPTY_CLOUD_QA_ASSERTIONS');
 const allPassed=r.checks.every(check=>check.passed===true);
 // Exit code AND the freshly written structured decision must both be green.
 const decision=(result===0 && allPassed && r.conclusion==='PROVIDER_CLOUD_PASS')
  ?'PROVIDER_CLOUD_PASS':'FAIL';
 summary={decision,checks:r.checks.map(({action,role,passed,remaining,error})=>({
  action,role,passed,remaining,errorType:error?String(error).slice(0,200):undefined
 })),projectId:expectedId,source};
 fs.copyFileSync(source,target+'/cloud-provider-result.json');
} catch {summary.decision='FAIL';summary.noResult=true;}
summary.exitCode=result;
fs.writeFileSync(target+'/status.json',JSON.stringify(summary,null,2)+'\n',{mode:0o600});
console.log('PROJECT='+expectedId);
console.log('RESULT='+summary.decision);
console.log('CHECK_COUNT='+summary.checks.length);
console.log('PASS_COUNT='+summary.checks.filter(x=>x.passed).length);
console.log('FAILURE_REASON='+(
 summary.checks.find(x=>x.passed===false)?.errorType||'none'
));
console.log('RUN_EXIT='+result);
if(result!==0||summary.decision!=='PROVIDER_CLOUD_PASS')process.exitCode=1;
