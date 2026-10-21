/**
 * Authorized Cloud QA only: reuse approved LiveKit CLI credentials without
 * writing, printing or checking in keys. Firebase accounts are demo-emulated.
 */
import fs from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { validateAuthenticatedCloudUatReceipt } from './validated-luma-cloud-uat.mjs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const yaml=require('js-yaml');
const configPath=process.env.LUMA_QA_CLI_CONFIG_PATH ||
 '/opt/luma-livekit-qa/privatehome/.livekit/cli-config.yaml';
const projectId='p_5650huuc5om';
const expectedEndpoint='wss://luma-0x6n7955.livekit.cloud';
if(process.env.LUMA_CLOUD_QA_ALLOWED!=='app-e2e') {
 throw new Error('Denied: LUMA_CLOUD_QA_ALLOWED=app-e2e required');
}
if(fs.statSync(configPath).mode & 0o077) {
 throw new Error('Denied: unsafe LiveKit CLI credentials file mode');
}
const cfg=yaml.load(fs.readFileSync(configPath,'utf8'));
const projects=Array.isArray(cfg.projects)?cfg.projects:Object.values(cfg.projects||{});
const p=projects.find(p=>p.project_id===projectId && p.url===expectedEndpoint);
if(!p?.api_key || !p?.api_secret)throw new Error('Denied: project credentials mismatch');
const out='evidence/live-classroom-acceptance/two-students-cloud-app-20261020';
fs.mkdirSync(out,{recursive:true});
// Historical PASS receipts are inert source fixtures. Never allow a crashed
// child process to inherit an earlier successful authenticated app test.
const reportFile=out+'/authenticated-e2e-result.json';
const statusFile=out+'/run-status.json';
for(const path of [reportFile,statusFile])fs.rmSync(path,{force:true});
const runStartedAt=Date.now();
const expectedSourceSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const output=fs.createWriteStream(out+'/runner.log',{flags:'w',mode:0o600});
const java='/opt/luma-jre21';
if(!fs.existsSync(java+'/bin/java'))throw new Error('Firebase Emulator JRE21 unavailable');
const env={...process.env,
 GOOGLE_CLOUD_PROJECT:'demo-luma-live-uat',
 LIVEKIT_URL:expectedEndpoint,
 LIVEKIT_API_KEY:p.api_key,
 LIVEKIT_API_SECRET:p.api_secret,
 LIVEKIT_CLOUD_PROJECT_ID:projectId,
 LUMA_CLOUD_QA_ALLOWED:'app-e2e',
 JAVA_HOME:java,
 PATH:java+'/bin:'+process.env.PATH,
 NODE_EXTRA_CA_CERTS:''};
const child=spawn('firebase',
 ['--config','firebase.qa-live-e2e.json',
  'emulators:exec','--project','demo-luma-live-uat','--only','auth,firestore',
  'node scripts/qa/live-two-students-cloud-e2e.mjs'],
 {cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
const sanitize=v=>v.replaceAll(p.api_secret,'[SECRET_MASKED]')
 .replaceAll(p.api_key,'[KEY_MASKED]')
 .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g,'[JWT_MASKED]');
const buffers=new Map();
function capture(stream,chunk) {
 const str=(buffers.get(stream)||'')+chunk.toString('utf8');
 const keep=Math.max(p.api_secret.length,p.api_key.length)+100;
 if(str.length<=keep){buffers.set(stream,str);return;}
 stream.write(sanitize(str.slice(0,-keep)));
 buffers.set(stream,str.slice(-keep));
}
child.stdout.on('data',b=>capture(output,b));
child.stderr.on('data',b=>capture(output,b));
child.on('error',err=>{output.write('RUN_SPAWN_ERROR '+err.name+'\n');});
const code=await new Promise(resolve=>child.on('close',resolve));
for(const value of buffers.values())output.write(sanitize(value));
output.end();
let summary={projectId,kind:'CLOUD_APP_E2E_WITH_FIREBASE_AUTH_AND_FIRESTORE_EMULATORS',
 sourceSha:expectedSourceSha,overall:'FAILED_QA_RECEIPT',pass:0,fail:1,blocked:0,
 failures:[],exitCode:code};
try {
 const stat=fs.statSync(reportFile);
 const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
 const accepted=validateAuthenticatedCloudUatReceipt({report,expectedSourceSha,
   runStartedAtMs:runStartedAt,reportMtimeMs:stat.mtimeMs,childExitCode:code});
 summary={...summary,...accepted,failures:[],exitCode:code};
} catch(error) {
 // Never echo an exception containing live keys, JWTs or customer identities.
 const reason=error instanceof Error?error.message:'QA_RECEIPT_VALIDATION_FAILED';
 summary.failures=[{name:'authenticated_qa_receipt',reason:reason.slice(0,110)}];
}
fs.writeFileSync(statusFile,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
if(summary.overall!=='PASS_AUTHENTICATED_LUMA_CLOUD_E2E')process.exitCode=1;
