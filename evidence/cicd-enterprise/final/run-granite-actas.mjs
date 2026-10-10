import fs from 'node:fs';
const base = new URL('.', import.meta.url).pathname;
const input = JSON.parse(fs.readFileSync(base + 'granite-actas-input.json', 'utf8'));
const prompt = 'Act as adversarial IBM Granite security reviewer. A GitHub OIDC release service account already has Firebase App Hosting builds.create, but createBuild failed on iam.serviceAccounts.actAs. Proposed remediation: bind roles/iam.serviceAccountUser ONLY on firebase-app-hosting-compute service account, to the release identity. Existing OIDC provider restricts immutable repository ID, owner ID, main, production env, exact workflow and push event. Script is idempotent, checks policy etag and exact identities, and reads back grant. State actual residual risks; do not assert production success. Output valid JSON UNDER 110 words with keys verdict (CONDITIONAL_PASS or FAIL), findings (array of {severity,risk,mitigation}), limitations (array). Keep maximum TWO findings.' ;
try {
const response = await fetch('http://127.0.0.1:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'ibm/granite3.3:2b',prompt,stream:true,think:false,format:'json',options:{temperature:0,num_ctx:4096,num_predict:420}}),signal:AbortSignal.timeout(180000)});
if (!response.ok) throw new Error('Granite HTTP '+response.status);
let buf='', text='', final;const decoder=new TextDecoder();
for await (const chunk of response.body) {buf+=decoder.decode(chunk,{stream:true});let idx;while((idx=buf.indexOf('\n'))>=0){const line=buf.slice(0,idx).trim();buf=buf.slice(idx+1);if(!line)continue;const j=JSON.parse(line);if(j.error)throw new Error(j.error);text+=j.response??'';final=j;}}
if(!final?.done || final.done_reason==='length')throw new Error('Model incomplete: '+text);
const evaluation=JSON.parse(text);
const result={model:final.model,complete:true,reviewedAt:new Date().toISOString(),evaluation};
fs.writeFileSync(base+'granite-actas-review.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
} catch(e){fs.writeFileSync(base+'granite-actas-review-failure.json',JSON.stringify({status:'BLOCKED',error:String(e)},null,2)+'\n');console.error(e);process.exitCode=1;}
