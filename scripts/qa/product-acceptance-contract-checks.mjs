import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,mkdirSync,writeFileSync,rmSync } from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {canonicalAcceptanceBytes,acceptanceContentDigest,unsignedAcceptanceProof} from './acceptance-attestation.mjs';
import {evaluateAcceptance} from './product-acceptance-gate.mjs';
const sha='a'.repeat(40);
const now='2026-10-19T07:10:00.000Z';
const action=(id,path)=>({id,title:id,actor:'tenant_admin',path,uiFiles:[`src/app/${id}.tsx`],
  serviceFiles:[`src/lib/${id}.ts`],serverOutcome:'Durable learner-facing effect',
  negative:'403 for another tenant',recovery:'Resolve 503 and retry',requiredVariants:['ten_courses']});
const catalog={schemaVersion:'luma.product-acceptance.v1',project:'LUMA',
  customerContext:{validatedWithCustomer:true},
  policy:{manualReleaseGates:['business_owner_uat_signed']},
  modules:[{id:'course',title:'Operational course management',required:true,
    actions:[action('create','/studio/programs'),action('edit','/studio/programs')]}],
  journeys:[{id:'AGRO-REAL',title:'Create, edit and verify course',actions:['create','edit'],
    variants:['ten_courses','evergreen'],outcome:'Learner receives authorized material'}]};
function build(){
  const root=mkdtempSync(join(tmpdir(),'luma-acceptance-test-'));
  const write=(path,value)=>{const absolute=join(root,path);mkdirSync(dirname(absolute),{recursive:true});writeFileSync(absolute,value);return {path,sha256:createHash('sha256').update(value).digest('hex')};};
  for(const a of catalog.modules[0].actions)for(const file of [...a.uiFiles,...a.serviceFiles])write(file,'export const tested = true;');
  const verifierKey=generateKeyPairSync('ed25519');
  const customerKey=generateKeyPairSync('ed25519');
  const trustStore={schemaVersion:'luma.acceptance.trust.v1',repository:'BernydotJar/LUMA',
    catalogSha256:acceptanceContentDigest(catalog),keys:[
      {keyId:'qa-key-2026',subject:'independent-sdet',roles:['independent-sdet'],
        publicKeyPem:verifierKey.publicKey.export({format:'pem',type:'spki'})},
      {keyId:'customer-key-2026',subject:'customer-owner',roles:['customer-approver'],
        publicKeyPem:customerKey.publicKey.export({format:'pem',type:'spki'})},
    ]};
  const signAs=(proof,subject)=>{
    const [keyId,key]=subject==='customer-owner'?['customer-key-2026',customerKey]:['qa-key-2026',verifierKey];
    return {...proof,attestation:{algorithm:'Ed25519',keyId,
      signature:sign(null,canonicalAcceptanceBytes(proof),key.privateKey).toString('base64url')}};
  };
  const files={browserTrace:write('proof/browser-trace.txt','browser trace complete'),
    serverReadback:write('proof/server-readback.json','{"persisted":true,"authDenied":true}'),
    businessTrace:write('proof/business-trace.txt','business outcome; two variants'),
    uat:write('proof/human-signoff.txt','reviewer evidence')};
  const common=(environment)=>({sourceSha:sha,environment,producer:'implementation-team',
    independentVerifier:'independent-sdet',syntheticTenant:true,verifiedIdentity:true,exactRunId:'run-1234567',
    executedAt:now});
  const actionReceipt=(a,environment)=>({...common(environment),actionId:a.id,actor:a.actor,
    ui:{path:a.path,activated:true,locator:'getByRole(button,{name:"Save"})',
      discoveryMethod:'in_app_navigation',navigationPath:['/',a.path],operationId:'operation-123456789'},
    server:{receiptId:'synthetic-receipt-123',readBack:true,readBackAfterNewSession:true,
      actorScoped:true,tenantScoped:true,operationId:'operation-123456789'},
    negative:{denied:true,httpStatus:403,crossTenantDenied:true},
    recovery:{completed:true,serverReadBack:true,verifiedViaUi:true},
    variants:['ten_courses'],artifacts:{browserTrace:files.browserTrace,serverReadback:files.serverReadback}});
  const journeyReceipt=(environment)=>({...common(environment),journeyId:'AGRO-REAL',
    endToEndBusinessOutcome:true,serverReadback:true,authorizationDenialsVerified:true,
    recoveryTested:true,emptyAndErrorStatesTested:true,uiEntryPointUsed:true,
    actorTransitionsVerified:true,logoutRestoreVerified:true,
    actions:['create','edit'],variants:['ten_courses','evergreen'],
    artifacts:{businessTrace:files.businessTrace}});
  const receipts={actions:{},productionActions:{},journeys:{},productionJourneys:{},
    manual:{business_owner_uat_signed:{gate:'business_owner_uat_signed',sourceSha:sha,
      signedOffByHuman:true,approvalSystemRef:'uat-reference-12345',producer:'implementation-team',
      reviewer:'customer-owner',signedAt:now,artifact:files.uat}}};
  for(const a of catalog.modules[0].actions){
    receipts.actions[a.id]=signAs(actionReceipt(a,'staging'),'independent-sdet');
    receipts.productionActions[a.id]=signAs(actionReceipt(a,'production'),'independent-sdet');
  }
  receipts.journeys['AGRO-REAL']=signAs(journeyReceipt('staging'),'independent-sdet');
  receipts.productionJourneys['AGRO-REAL']=signAs(journeyReceipt('production'),'independent-sdet');
  receipts.manual.business_owner_uat_signed=signAs(receipts.manual.business_owner_uat_signed,'customer-owner');
  const inventory={origin:'https://luma.lch-app.cloud',checkedAt:now,mode:'UNAUTHENTICATED READ_ONLY',
    routes:[{path:'/studio/programs',httpStatus:200,browserUrl:'https://luma.lch-app.cloud/studio/programs',headings:['Programs'],
      actions:[{kind:'BUTTON',label:'Theme'}]}]};
  const publication={gitSha:sha,origin:'https://luma.lch-app.cloud',status:200,
    checkedAt:now,repository:'BernydotJar/LUMA'};
  return {root,receipts,inventory,publication,files,trustStore,signAs};
}
function verify(ctx,opts={}){return evaluateAcceptance({catalog,inventory:ctx.inventory,publication:ctx.publication,
  receipts:ctx.receipts,sourceRoot:ctx.root,sourceSha:sha,observedAt:now,phase:'postdeploy',
  trustStore:ctx.trustStore,...opts});}
function fixtureTest(name,fn){test(name,()=>{const ctx=build();try{fn(ctx);}finally{rmSync(ctx.root,{recursive:true,force:true});}});}
fixtureTest('200 with visible data and generic 125 green E2E cannot approve ANY product action',ctx=>{
  const result=verify(ctx,{receipts:{genericE2EResult:{passed:125,failed:0}}});
  assert.equal(result.verdict,'BLOCKED');assert.equal(result.modules[0].status,'BLOCKED');
  assert.equal(result.journeys[0].status,'BLOCKED');
});
fixtureTest('one implemented and tested action does not approve a two-action module',ctx=>{
  delete ctx.receipts.actions.edit;
  const result=verify(ctx);
  assert.equal(result.modules[0].status,'BLOCKED');
  assert.equal(result.modules[0].actions.find(x=>x.id==='create').verdict,'PASS');
  assert.equal(result.journeys[0].status,'BLOCKED');
});
fixtureTest('UI click without server readback is not functional',ctx=>{
  ctx.receipts.productionActions.create.server.readBack=false;
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
});
fixtureTest('cross-tenant denial and recovery are mandatory',ctx=>{
  delete ctx.receipts.actions.edit.negative;
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
  ctx.receipts.actions.edit.negative={denied:true,httpStatus:403};
  ctx.receipts.productionActions.create.recovery.completed=false;
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
});
fixtureTest('a mismatched or unavailable deployed revision cannot be accepted',ctx=>{
  ctx.publication.gitSha='b'.repeat(40);
  const result=verify(ctx);assert.equal(result.verdict,'BLOCKED');
  assert.ok(result.blockers.includes('PRODUCTION_NOT_EXACT_REVIEWED_COMMIT'));
  ctx.publication.gitSha=sha;
  ctx.inventory.routes[0].httpStatus=404;
  assert.equal(verify(ctx).modules[0].actions[0].interface,'ROUTE_404');
});
fixtureTest('no authenticated browser trace or tampered proof cannot approve',ctx=>{
  ctx.receipts.actions.create.artifacts.browserTrace={...ctx.files.browserTrace,sha256:'1'.repeat(64)};
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
});
fixtureTest('missing live UAT, manual signoff or stale data always blocks',ctx=>{
  const before=ctx.receipts.manual.business_owner_uat_signed;
  delete ctx.receipts.manual.business_owner_uat_signed;
  assert.equal(verify(ctx).verdict,'BLOCKED');
  ctx.receipts.manual.business_owner_uat_signed={...before, artifact:{...before.artifact,sha256:'0'.repeat(64)}};
  assert.equal(verify(ctx).verdict,'BLOCKED');
  ctx.receipts.manual.business_owner_uat_signed=before;
  ctx.inventory.checkedAt='2026-10-18T06:00:00.000Z';
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
});
fixtureTest('predeploy can only be candidate PASS after all staging, signoff and source references',ctx=>{
  const r=verify(ctx,{phase:'predeploy',publication:{gitSha:'b'.repeat(40)}});
  assert.equal(r.verdict,'PASS');assert.equal(r.releaseAllowed,false);
  rmSync(join(ctx.root,'src/lib/edit.ts'));
  assert.equal(verify(ctx,{phase:'predeploy'}).verdict,'BLOCKED');
});
fixtureTest('inventory cannot be promoted to release even if all simulated witnesses are present',ctx=>{
  assert.equal(verify(ctx,{phase:'inventory'}).verdict,'BLOCKED');
});
fixtureTest('a *complete synthetic fixture* demonstrates schema logic, not real LUMA readiness',ctx=>{
  const result=verify(ctx);
  assert.equal(result.verdict,'PASS');assert.equal(result.modules[0].status,'PASS');
  assert.equal(result.journeys[0].status,'PASS');assert.equal(result.releaseAllowed,true);
});
fixtureTest('unlisted mandatory action in business journeys is an invalid acceptance contract',ctx=>{
  assert.throws(()=>verify(ctx,{catalog:{...catalog,journeys:[{...catalog.journeys[0],actions:['create']}]}}),
    /ACCEPTANCE_UNTESTED_MANDATORY_ACTION/);
});

fixtureTest('unsigned, forged or self-declared evidence cannot pass the independence gate',ctx=>{
  assert.equal(verify(ctx).verdict,'PASS');
  delete ctx.receipts.productionActions.create.attestation;
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
  ctx.receipts.productionActions.create=ctx.signAs(ctx.receipts.productionActions.create,'independent-sdet');
  ctx.receipts.productionActions.create.independentVerifier='implementation-team';
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
});
fixtureTest('protected trust store and catalog digest cannot come from a receipt',ctx=>{
  assert.equal(verify(ctx,{trustStore:null}).verdict,'BLOCKED');
  assert.equal(verify(ctx,{trustStore:{...ctx.trustStore,catalogSha256:'f'.repeat(64)}}).verdict,'BLOCKED');
  assert.equal(verify(ctx,{trustStore:{...ctx.trustStore,keys:[]}}).verdict,'BLOCKED');
});
fixtureTest('modifying claims after an independent signature invalidates acceptance',ctx=>{
  ctx.receipts.productionJourneys['AGRO-REAL'].endToEndBusinessOutcome=false;
  assert.equal(verify(ctx).journeys[0].status,'BLOCKED');
});
fixtureTest('manual signoff must be authenticated by trusted human role',ctx=>{
  const before=ctx.receipts.manual.business_owner_uat_signed;
  ctx.receipts.manual.business_owner_uat_signed=ctx.signAs(unsignedAcceptanceProof(before),'independent-sdet');
  assert.equal(verify(ctx).manual.business_owner_uat_signed,'BLOCKED');
});

fixtureTest('typing a deep URL does not prove that a first-time customer can discover the action',ctx=>{
  ctx.receipts.productionActions.create.ui.discoveryMethod='direct_url';
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
});
fixtureTest('saving through an API without a related UI operation or reload proof fails',ctx=>{
  ctx.receipts.actions.create.server.operationId='different-api-operation';
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
  ctx.receipts.actions.create.server.operationId='operation-123456789';
  ctx.receipts.actions.create.server.readBackAfterNewSession=false;
  assert.equal(verify(ctx).modules[0].status,'BLOCKED');
});
fixtureTest('business journey cannot pass with incomplete role handoffs or reversed steps',ctx=>{
  ctx.receipts.productionJourneys['AGRO-REAL'].actions=['edit','create'];
  assert.equal(verify(ctx).journeys[0].status,'BLOCKED');
  ctx.receipts.productionJourneys['AGRO-REAL'].actions=['create','edit'];
  ctx.receipts.productionJourneys['AGRO-REAL'].actorTransitionsVerified=false;
  assert.equal(verify(ctx).journeys[0].status,'BLOCKED');
});
