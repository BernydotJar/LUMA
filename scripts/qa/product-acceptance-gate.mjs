#!/usr/bin/env node
/**
 * Fail-closed PRODUCT (not E2E-suite) operational acceptance.
 * Inventory is deliberately advisory; predeploy/postdeploy enforce a complete
 * action-by-action, multi-role customer journey with independent receipts.
 * This tool performs NO writes, API mutations or browser actions.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, realpathSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, relative, sep, isAbsolute } from 'node:path';
import { acceptanceContentDigest, verifyIndependentAcceptance, REQUIRED_MANUAL_SIGNER_ROLE } from './acceptance-attestation.mjs';
import { pathToFileURL } from 'node:url';

const SHA40=/^[a-f0-9]{40}$/;
const SHA64=/^[a-f0-9]{64}$/;
const phases=['inventory','predeploy','postdeploy'];
export const defaultCatalogPath='docs/product-acceptance/catalog.json';
export const defaultInventoryPath='evidence/product-acceptance-2026-10-19/public-ui-readonly.json';

function safeObject(raw){return raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {};}
function validPath(p,root){
  if(typeof p!=='string'||p.startsWith('/')||p.includes('\\')||p.includes('\0')||!p.trim())return false;
  const target=resolve(root,p);
  return target.startsWith(resolve(root)+sep) && !relative(root,target).split(sep).includes('..');
}
function checkArtifact(ref,root){
  if(!ref || !validPath(ref.path,root)||!SHA64.test(ref.sha256||''))return false;
  const file=resolve(root,ref.path);
  if(!existsSync(file))return false;
  try{
    const resolved=realpathSync(file), project=realpathSync(root);
    if(!resolved.startsWith(project+sep)||!statSync(resolved).isFile()||statSync(resolved).size>20_000_000)return false;
    return createHash('sha256').update(readFileSync(resolved)).digest('hex')===ref.sha256;
  } catch{return false;}
}
function timely(value,now,maxAgeMs){
  const date=typeof value==='string'?Date.parse(value):NaN;
  const reference=typeof now==='string'?Date.parse(now):NaN;
  return Number.isFinite(date)&&Number.isFinite(reference)&&date<=reference+60_000 &&
    date>=reference-maxAgeMs;
}
function acceptableActor(proof,sha,environment,observedAt,trustStore){
  return proof && proof.sourceSha===sha && proof.environment===environment &&
    typeof proof.producer==='string' && proof.producer.length>=3 &&
    typeof proof.independentVerifier==='string' && proof.independentVerifier.length>=3 &&
    proof.producer!==proof.independentVerifier &&
    proof.syntheticTenant===true && proof.verifiedIdentity===true &&
    timely(proof.executedAt,observedAt,24*60*60*1000) &&
    typeof proof.exactRunId==='string' && proof.exactRunId.length>=7 &&
    verifyIndependentAcceptance(proof,trustStore,'independent-sdet',proof.independentVerifier);
}
function evaluateActionProof(proof,action,sha,environment,root,observedAt,trustStore){
  if(!acceptableActor(proof,sha,environment,observedAt,trustStore))return {pass:false,reason:'MISSING_INDEPENDENT_AUTHENTICATED_ACTION_PROOF'};
  if(proof.actionId!==action.id||proof.actor!==action.actor||proof.ui?.path!==action.path||
      proof.ui?.activated!==true||typeof proof.ui?.locator!=='string'||!proof.ui.locator.trim()||
      proof.ui.discoveryMethod!=='in_app_navigation'||
      !Array.isArray(proof.ui.navigationPath)||proof.ui.navigationPath.length<2||
      !['/','/learn','/studio','/login'].includes(proof.ui.navigationPath[0])||
      proof.ui.navigationPath.at(-1)!==action.path||
      typeof proof.ui.operationId!=='string'||proof.ui.operationId.length<8){
    return {pass:false,reason:'NO_DISCOVERABLE_ACTIVATED_USER_INTERFACE_ACTION'};
  }
  if(proof.server?.readBack!==true||proof.server?.tenantScoped!==true||
      proof.server?.readBackAfterNewSession!==true||proof.server?.actorScoped!==true||
      proof.server?.operationId!==proof.ui.operationId||
      typeof proof.server?.receiptId!=='string'||proof.server.receiptId.length<8){
    return {pass:false,reason:'MISSING_AUTHORIZED_SERVER_SIDE_RESULT_OR_SESSION_RESTORE'};
  }
  if(proof.negative?.denied!==true || proof.negative?.crossTenantDenied!==true ||
      ![401,403,404,409,410,429].includes(proof.negative?.httpStatus) ||
      proof.recovery?.completed!==true || proof.recovery?.serverReadBack!==true ||
      proof.recovery?.verifiedViaUi!==true){
    return {pass:false,reason:'NEGATIVE_OR_RECOVERY_PATH_NOT_PROVEN'};
  }
  if(!action.requiredVariants.every(v=>(proof.variants||[]).includes(v))){
    return {pass:false,reason:'REQUIRED_ACTION_VARIANTS_NOT_COVERED'};
  }
  if(!checkArtifact(proof.artifacts?.browserTrace,root)||!checkArtifact(proof.artifacts?.serverReadback,root)){
    return {pass:false,reason:'MISSING_OR_TAMPERED_ACTION_TRACE'};
  }
  return {pass:true,reason:'INDEPENDENT_ACTION_AND_PERSISTENCE_PROVEN'};
}
function evaluateJourneyProof(proof,journey,sha,environment,root,observedAt,trustStore){
  if(!acceptableActor(proof,sha,environment,observedAt,trustStore))return {pass:false,reason:'MISSING_INDEPENDENT_BUSINESS_JOURNEY_PROOF'};
  let lastIndex=-1;
  const ordered=Array.isArray(proof.actions)&&journey.actions.every(action=>{
    const index=proof.actions.indexOf(action,lastIndex+1);
    if(index<=lastIndex)return false;
    lastIndex=index;
    return true;
  });
  if(proof.journeyId!==journey.id || proof.endToEndBusinessOutcome!==true ||
      proof.serverReadback!==true || proof.authorizationDenialsVerified!==true ||
      proof.recoveryTested!==true || proof.emptyAndErrorStatesTested!==true ||
      proof.uiEntryPointUsed!==true || proof.actorTransitionsVerified!==true ||
      proof.logoutRestoreVerified!==true || !ordered ||
      !journey.variants.every(v=>(proof.variants||[]).includes(v)) ||
      !checkArtifact(proof.artifacts?.businessTrace,root)){
    return {pass:false,reason:'INCOMPLETE_END_TO_END_BUSINESS_FLOW'};
  }
  return {pass:true,reason:'COMPLETE_CUSTOMER_WORKFLOW_PROVEN'};
}
function evaluateManualGate(proof,gate,sha,root,observedAt,trustStore){
  return Boolean(proof && proof.sourceSha===sha && proof.gate===gate &&
    proof.signedOffByHuman===true && typeof proof.approvalSystemRef==='string' &&
    proof.approvalSystemRef.length>6 && proof.producer!==proof.reviewer &&
    timely(proof.signedAt,observedAt,90*24*60*60*1000) &&
    checkArtifact(proof.artifact,root) &&
    typeof REQUIRED_MANUAL_SIGNER_ROLE[gate]==='string' &&
    verifyIndependentAcceptance(proof,trustStore,REQUIRED_MANUAL_SIGNER_ROLE[gate],proof.reviewer));
}
export function evaluateAcceptance({catalog,inventory={},publication={},receipts={},sourceRoot,sourceSha,
  phase='inventory',observedAt=new Date().toISOString(),trustStore=null}){
  if(!phases.includes(phase)||!SHA40.test(sourceSha))throw Error('ACCEPTANCE_INPUT_INVALID');
  if(catalog?.schemaVersion!=='luma.product-acceptance.v1'||!Array.isArray(catalog.modules)||
      !Array.isArray(catalog.journeys)||catalog.modules.length===0)throw Error('ACCEPTANCE_CATALOG_INVALID');
  const ids=new Set(),moduleNames=new Set(),issues=[];
  for(const capability of catalog.modules){
    if(typeof capability.id!=='string'||moduleNames.has(capability.id)||!Array.isArray(capability.actions)||!capability.actions.length)
      throw Error('ACCEPTANCE_MODULE_INVALID');
    moduleNames.add(capability.id);
    for(const action of capability.actions){
      if(typeof action.id!=='string'||ids.has(action.id)||!action.path?.startsWith('/')||
         !Array.isArray(action.uiFiles)||!Array.isArray(action.serviceFiles)||
         !Array.isArray(action.requiredVariants)||!action.serverOutcome||!action.negative||!action.recovery)
        throw Error('ACCEPTANCE_ACTION_INVALID');
      ids.add(action.id);
    }
  }
  const journeyIds=new Set();
  for(const journey of catalog.journeys){
    if(!Array.isArray(journey.actions)||!journey.actions.length||!Array.isArray(journey.variants)||
       journeyIds.has(journey.id)||!journey.outcome)throw Error('ACCEPTANCE_JOURNEY_INVALID');
    journeyIds.add(journey.id);
    for(const a of journey.actions)if(!ids.has(a))throw Error('ACCEPTANCE_JOURNEY_REFERENCES_UNKNOWN_ACTION');
  }
  const allJourneyActions=new Set(catalog.journeys.flatMap(j=>j.actions));
  for(const id of ids)if(!allJourneyActions.has(id))throw Error('ACCEPTANCE_UNTESTED_MANDATORY_ACTION');
  const trustedPolicy=trustStore?.schemaVersion==='luma.acceptance.trust.v1' &&
    trustStore.repository==='BernydotJar/LUMA' &&
    trustStore.catalogSha256===acceptanceContentDigest(catalog);
  if(phase!=='inventory' && !trustedPolicy)issues.push('MISSING_EXTERNAL_PROTECTED_TRUST_STORE_OR_CATALOG_SIGNATURE');
  const routes=new Map((Array.isArray(inventory.routes)?inventory.routes:[]).map(x=>[x.path,x]));
  const publicationSha=typeof publication.gitSha==='string'?publication.gitSha:null;
  const publishedSame=SHA40.test(publicationSha||'')&&publicationSha===sourceSha;
  const publicationFresh=timely(publication.checkedAt,observedAt,15*60*1000) &&
    publication.status===200 && publication.origin==='https://luma.lch-app.cloud' &&
    publication.repository==='BernydotJar/LUMA';
  const inventoryFresh=timely(inventory.checkedAt,observedAt,15*60*1000) &&
    inventory.origin==='https://luma.lch-app.cloud' && inventory.mode==='UNAUTHENTICATED READ_ONLY';
  const reported=[];
  for(const capability of catalog.modules){
    const actions=[];
    for(const a of capability.actions){
      const sourceFiles=[...a.uiFiles,...a.serviceFiles];
      const filesPresent=sourceFiles.length>0 && sourceFiles.every(x=>validPath(x,sourceRoot)&&existsSync(resolve(sourceRoot,x)));
      const liveRoute=routes.get(a.path);
      const observedRoute=liveRoute?.httpStatus===200 && !liveRoute.error &&
        liveRoute.browserUrl==='https://luma.lch-app.cloud'+a.path;
      const inProduction=publishedSame && publicationFresh && inventoryFresh && observedRoute;
      const stage=evaluateActionProof(safeObject(receipts.actions)[a.id],a,sourceSha,'staging',sourceRoot,observedAt,trustStore);
      const deployed=evaluateActionProof(safeObject(receipts.productionActions)[a.id],a,sourceSha,'production',sourceRoot,observedAt,trustStore);
      const ready=filesPresent&&stage.pass;
      const productPass=ready && inProduction && deployed.pass;
      const blockers=[];
      if(!filesPresent)blockers.push('NO_MATCHING_SOURCE_REFERENCES');
      if(!stage.pass)blockers.push(stage.reason);
      if(!publishedSame)blockers.push('DEPLOYMENT_SHA_DOES_NOT_MATCH_REVIEWED_SOURCE');
      if(!publicationFresh||!inventoryFresh)blockers.push('LIVE_DEPLOYMENT_PROOF_MISSING_OR_STALE');
      if(!observedRoute)blockers.push(liveRoute?.httpStatus===404?'ROUTE_404_IN_PRODUCTION':'NO_PUBLISHED_ROUTE_PROOF');
      if(!deployed.pass)blockers.push('NO_AUTHENTICATED_PRODUCTION_ACTION_VERIFICATION');
      actions.push({id:a.id,actor:a.actor,path:a.path,
        source:filesPresent?'SOURCE_REFERENCES_PRESENT_NOT_FUNCTION_PROOF':'MISSING_OR_UNMATCHED_SOURCE',
        interface:observedRoute?'ROUTE_RENDERS_ACTION_NOT_YET_PROVEN':liveRoute?.httpStatus===404?'ROUTE_404':'UNVERIFIED',
        authorizedStagingAction:stage.pass?'VERIFIED':'BLOCKED',
        published:inProduction?'MATCHING_SHA_ROUTE':'NOT_VERIFIED',
        productionAction:deployed.pass?'VERIFIED':'BLOCKED',
        verdict:productPass?'PASS':'BLOCKED',blockers});
    }
    const required=capability.required!==false;
    const status=actions.every(a=>a.verdict==='PASS')?'PASS':'BLOCKED';
    if(required&&status!=='PASS')issues.push(`MODULE_${capability.id}_INCOMPLETE`);
    reported.push({id:capability.id,title:capability.title,status,required,actions});
  }
  const journeys=catalog.journeys.map(j=>{
    const stage=evaluateJourneyProof(safeObject(receipts.journeys)[j.id],j,sourceSha,'staging',sourceRoot,observedAt,trustStore);
    const prod=evaluateJourneyProof(safeObject(receipts.productionJourneys)[j.id],j,sourceSha,'production',sourceRoot,observedAt,trustStore);
    const actionPass=j.actions.every(id=>reported.some(m=>m.actions.some(a=>a.id===id && a.verdict==='PASS')));
    const verified=stage.pass&&prod.pass&&actionPass;
    if(!verified)issues.push(`JOURNEY_${j.id}_NOT_VERIFIED`);
    return {id:j.id,title:j.title,status:verified?'PASS':'BLOCKED',staging:stage.reason,
      production:prod.reason,allMandatoryActionsProven:actionPass,requiredVariants:j.variants};
  });
  const manual={};
  for(const gate of catalog.policy?.manualReleaseGates||[]){
    const ok=evaluateManualGate(safeObject(receipts.manual)[gate],gate,sourceSha,sourceRoot,observedAt,trustStore);
    manual[gate]=ok?'PASS':'BLOCKED';
    if(!ok)issues.push(`MANUAL_${gate}_MISSING`);
  }
  if(catalog.customerContext?.validatedWithCustomer!==true)issues.push('CUSTOMER_AGROCHEMICAL_REQUIREMENTS_UNCONFIRMED');
  if(!publishedSame)issues.push('PRODUCTION_NOT_EXACT_REVIEWED_COMMIT');
  if(phase==='predeploy'){
    // This is a candidate gate, not a published-product verdict. Do not list
    // expected postdeploy omissions as predeploy regressions.
    const candidateBlockers=[];
    if(!trustedPolicy)candidateBlockers.push('MISSING_EXTERNAL_PROTECTED_TRUST_STORE_OR_CATALOG_SIGNATURE');
    for(const m of reported){
      const candidatePass=m.actions.every(a=>a.authorizedStagingAction==='VERIFIED' &&
        a.source==='SOURCE_REFERENCES_PRESENT_NOT_FUNCTION_PROOF');
      m.stagingCandidateStatus=candidatePass?'PASS':'BLOCKED';
      if(!candidatePass)candidateBlockers.push(`STAGING_MODULE_${m.id}_NOT_VERIFIED`);
    }
    for(const j of journeys){
      if(j.staging!=='COMPLETE_CUSTOMER_WORKFLOW_PROVEN')
        candidateBlockers.push(`STAGING_JOURNEY_${j.id}_NOT_VERIFIED`);
    }
    for(const [gate,status] of Object.entries(manual)){
      if(status!=='PASS')candidateBlockers.push(`MANUAL_${gate}_MISSING`);
    }
    if(catalog.customerContext?.validatedWithCustomer!==true)
      candidateBlockers.push('CUSTOMER_REQUIREMENTS_NOT_CONFIRMED');
    const candidateReady=candidateBlockers.length===0;
    return {schemaVersion:'luma.product-acceptance.report.v1',phase,observedAt,candidateSha:sourceSha,
      observedProductionSha:publicationSha,verdict:candidateReady?'PASS':'BLOCKED',
      releaseAllowed:false,predeployCandidateReady:candidateReady,modules:reported,journeys,manual,
      blockers:candidateBlockers,
      note:'Predeploy PASS means only independently attested candidate eligibility. Publication and full product acceptance remain separate gates.'};
  }
  const complete=issues.length===0;
  return {schemaVersion:'luma.product-acceptance.report.v1',phase,observedAt,candidateSha:sourceSha,
    observedProductionSha:publicationSha,verdict:phase==='postdeploy'&&complete?'PASS':'BLOCKED',
    releaseAllowed:phase==='postdeploy'&&complete,modules:reported,journeys,manual,
    blockers:[...new Set(issues)],
    note:'Inventory NEVER approves a release. Live route 200 and generic E2E pass do not attest a functional user action. Production verification needs authorized test tenant/identities; NO live writes by this scanner.'};
}
function parseCli(argv){
  const values={};for(let i=0;i<argv.length;i++){
    const k=argv[i];if(!['--phase','--out','--inventory','--published','--receipts','--candidate-sha','--source-root'].includes(k)||values[k]!==undefined||!argv[i+1])
      throw Error('ACCEPTANCE_UNKNOWN_OR_DUPLICATED_FLAG');values[k]=argv[++i];
  }return values;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const argv=parseCli(process.argv.slice(2));
  const root=realpathSync(resolve(argv['--source-root']??resolve(import.meta.dirname,'../..')));
  const verifiedGitSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  const sourceSha=argv['--candidate-sha']??verifiedGitSha;
  const phase=argv['--phase']??'inventory';
  if(phase!=='inventory' && sourceSha!==verifiedGitSha)throw Error('ACCEPTANCE_SOURCE_SHA_MUST_MATCH_CHECKOUT');
  const protectedTrustPath=process.env.LUMA_ACCEPTANCE_TRUST_STORE;
  if(protectedTrustPath && (!isAbsolute(protectedTrustPath)||
     realpathSync(protectedTrustPath).startsWith(root+sep)))throw Error('ACCEPTANCE_TRUST_STORE_MUST_BE_EXTERNAL');
  const trustStore=protectedTrustPath?JSON.parse(readFileSync(realpathSync(protectedTrustPath),'utf8')):null;
  const load=(file,fallback)=>file&&existsSync(resolve(root,file))?JSON.parse(readFileSync(resolve(root,file),'utf8')):fallback;
  const catalog=load(defaultCatalogPath,null);
  const inventory=load(argv['--inventory']??defaultInventoryPath,{});
  const published=load(argv['--published']??'evidence/product-acceptance-2026-10-19/published-version.json',{});
  const receipts=load(argv['--receipts'],{});
  const report=evaluateAcceptance({catalog,inventory,publication:published,receipts,phase,sourceRoot:root,sourceSha,trustStore});
  const location=resolve(root,argv['--out']??'evidence/product-acceptance-2026-10-19/operational-readiness.json');
  mkdirSync(resolve(location,'..'),{recursive:true});writeFileSync(location,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({phase,verdict:report.verdict,sourceSha,observedProductionSha:report.observedProductionSha,
    modules:report.modules.length,actions:report.modules.flatMap(m=>m.actions).length,
    journeyCount:report.journeys.length,blockedModules:report.modules.filter(m=>m.status!=='PASS').map(m=>m.id),
    blockers:report.blockers.length,reportPath:location},null,2));
  if(phase!=='inventory'&&report.verdict!=='PASS')process.exitCode=2;
}
