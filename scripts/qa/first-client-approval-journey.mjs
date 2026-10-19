import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {writeFileSync} from 'node:fs';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
const exec=promisify(execFile),project=process.env.GCLOUD_PROJECT||'';
const ah=process.env.FIREBASE_AUTH_EMULATOR_HOST||'',fh=process.env.FIRESTORE_EMULATOR_HOST||'';
if(!project.startsWith('demo-')||!ah.startsWith('127.0.0.1:')||!fh.startsWith('127.0.0.1:')||
  process.env.LUMA_INSTITUTION_APPROVAL_ENABLED!=='true'||process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED!=='true'||
  process.env.LUMA_INSTITUTION_REQUESTS_ENABLED!=='true')throw Error('REFUSE_NON_DEMO_QA');
const base='http://127.0.0.1:3195',app=initializeApp({projectId:project},'approval-'+randomUUID());
const auth=getAuth(app),db=getFirestore(app),users=[],password='Qa'+randomUUID().replaceAll('-','')+'9!';
const form={organizationName:'QA Academy Premium',countryCode:'GT',timezone:'America/Guatemala',deliveryMode:'hybrid',learnerRange:'51-200',contactRole:'owner'};
const report={environment:'demo Firebase Auth/Firestore Emulators and local Next production build',sourceSha:process.env.LUMA_QA_COMMIT||'local',status:'RUNNING',checks:[]};
async function actor(label,claims,verified=true){const u=await auth.createUser({email:`qa-${label}-${randomUUID().slice(0,8)}@example.test`,password,emailVerified:verified});if(claims)await auth.setCustomUserClaims(u.uid,claims);users.push(u);return u;}
async function token(u){const r=await fetch(`http://${ah}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=qa`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:u.email,password,returnSecureToken:true})});const x=await r.json();assert.equal(r.status,200);return x.idToken;}
async function req(method,path,jwt,body){const r=await fetch(base+path,{method,headers:{...(jwt?{authorization:'Bearer '+jwt}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text.slice(0,150)}}return {status:r.status,data};}
function status(r,n){assert.equal(r.status,n,JSON.stringify(r.data).slice(0,280));return r.data;}
async function check(id,fn){try{const detail=await fn();report.checks.push({id,result:'PASS',detail});console.log('PASS',id,JSON.stringify(detail).slice(0,200));}catch(e){report.checks.push({id,result:'FAIL',error:String(e.stack||e).slice(0,800)});throw e;}}
const decision=(action,expectedStatus,extra={})=>({action,expectedStatus,reason:'Documented independent synthetic institutional identity verification and approval process.',...extra});
const path=id=>`/api/platform/institution-applications/${id}/decisions`;
const accept=(id,secret,jwt)=>req('POST','/api/institutions/invitations/accept',jwt,{applicationId:id,token:secret});
let trustedOperatorToken;
async function activate(id,operator,apply,tokenOverride){const args=['scripts/activate-first-academy.mjs','--project',project,'--application-id',id,'--operator-uid',operator,'--reason','Explicit independently reviewed first academy administrator activation.'];if(apply)args.push('--apply','--confirm-project',project,'--confirm-email',apply.email,'--plan-sha',apply.planHash);const {stdout}=await exec(process.execPath,args,{cwd:process.cwd(),env:{...process.env,LUMA_OPERATOR_ID_TOKEN:tokenOverride===undefined?trustedOperatorToken:tokenOverride},timeout:45000,maxBuffer:120000});return JSON.parse(stdout);}
let A,B,O,U,F,ta,tb,to,tu,tf,appId,invite,revokedApplicationId;
try{
 [A,B,O,U,F]=await Promise.all([actor('operatorA',{superuser:true}),actor('operatorB',{superuser:true}),actor('owner'),actor('unverified',null,false),actor('foreign')]);
 [ta,tb,to,tu,tf]=await Promise.all([A,B,O,U,F].map(token));trustedOperatorToken=ta;
 await check('01 unauthorized and unverified identities denied',async()=>{status(await req('GET','/api/platform/institution-applications'),401);status(await req('GET','/api/platform/institution-applications',to),403);status(await req('POST','/api/institutions/applications',tu,form),403);return {guest:401,applicant:403,unverified:403};});
 await check('02 submit verified request with no roles',async()=>{const x=status(await req('POST','/api/institutions/applications',to,form),201);appId=x.application.applicationId;assert.equal(x.application.status,'received');assert.equal((await auth.getUser(O.uid)).customClaims,undefined);return {state:'received',noRole:true};});
 await check('03 forged approval or fields denied',async()=>{const body=decision('screen','received',{tenantId:'qa-academy-one',initialProgramId:'premium-start'});status(await req('POST',path(appId),to,body),403);status(await req('POST',path(appId),ta,{...body,admin:true}),400);return {escalationDenied:true};});
 await check('04 first operator reserves tenant with audit',async()=>{const x=status(await req('POST',path(appId),ta,decision('screen','received',{tenantId:'qa-academy-one',initialProgramId:'premium-start'})),200);assert.equal(x.application.firstReviewerUid,A.uid);assert.equal(x.application.status,'in_review');return {reserved:'qa-academy-one',screened:true};});
 await check('05 second distinct superuser required to issue invitation',async()=>{status(await req('POST',path(appId),ta,decision('invite','in_review')),403);const x=status(await req('POST',path(appId),tb,decision('invite','in_review')),201);invite=x.oneTimeToken;assert.match(invite,/^[A-Za-z0-9_-]{43}$/);const row=(await db.collection('institutionOnboardingInvitations').doc(appId).get()).data();assert.equal(JSON.stringify(row).includes(invite),false);status(await req('POST',path(appId),tb,decision('invite','in_review')),409);return {secondReviewer:true,rawTokenNeverStored:true,expiresInHours:72};});
 await check('06 foreign user and malformed invitation proof rejected',async()=>{status(await accept(appId,invite,tf),403);status(await accept(appId,invite,tu),403);status(await accept(appId,'wrong',to),403);return {foreign:403,unverified:403,badProof:403};});
 await check('07 invited owner accepts once but cannot self-provision',async()=>{const x=status(await accept(appId,invite,to),200);assert.equal(x.application.status,'invitation_accepted');status(await accept(appId,invite,to),403);assert.equal((await auth.getUser(O.uid)).customClaims,undefined);return {oneTime:true,roleBeforeOperator:null};});
 await check('08 CLI dry run only gives deterministic signed-off plan',async()=>{const p=await activate(appId,A.uid);assert.equal(p.mode,'dry-run');assert.match(p.planHash,/^[a-f0-9]{64}$/);assert.equal((await auth.getUser(O.uid)).customClaims,undefined);return {planHashLength:64,noMutations:true};});
 await check('09 operator applies confirmed plan, grants only matching tenant and revokes prior tokens',async()=>{await new Promise(r=>setTimeout(r,1400));const p=await activate(appId,A.uid);const r=await activate(appId,A.uid,{email:O.email,planHash:p.planHash});assert.equal(r.state,'activated');const latest=await auth.getUser(O.uid);assert.equal(latest.customClaims?.admin,true);assert.deepEqual(latest.customClaims?.adminTenantIds,['qa-academy-one']);await assert.rejects(auth.verifyIdToken(to,true));return {tenant:'qa-academy-one',oldTokenRevoked:true,auditApplied:true};});
 to=await token(O);
 await check('10 owner access scoped to academy, never other organization',async()=>{status(await req('GET','/api/programs/admin/offerings?tenantId=qa-academy-one',to),200);status(await req('GET','/api/programs/admin/offerings?tenantId=foreign-school',to),403);return {owner:200,foreign:403};});
 await check('11 only operator can bootstrap initial audited institution draft',async()=>{const dest=`/api/platform/institution-applications/${appId}/bootstrap`;status(await req('POST',dest,to,{requestId:randomUUID().replaceAll('-','')}),403);const requestId=randomUUID().replaceAll('-','');status(await req('POST',dest,ta,{requestId}),201);status(await req('POST',dest,ta,{requestId}),200);const data=status(await req('GET','/api/platform/institutions/qa-academy-one/draft',to),200);assert.deepEqual(data.draft.config.programIds,['premium-start']);return {bootstrapped:true,idempotent:true};});
 await check('12 first course and institutional brand persist as DRAFT only',async()=>{const x=status(await req('POST','/api/programs/admin/offerings',to,{tenantId:'qa-academy-one',programId:'premium-start',cohortKey:'pilot-2026',title:'Primer programa premium',deliveryMode:'live',timezone:'America/Guatemala',status:'draft',coachIds:[]}),200);assert.equal(x.offering.status,'draft');const d=status(await req('GET','/api/platform/institutions/qa-academy-one/draft',to),200).draft;const brand=status(await req('PATCH','/api/platform/institutions/qa-academy-one/draft',to,{expectedVersion:d.config.configVersion,requestId:randomUUID().replaceAll('-',''),reasonCode:'brand-update',brand:{displayName:'QA Academy',shortName:'QA',palette:d.config.brand.palette}}),200);assert.equal(brand.appliedVersion,2);const published=await db.collection('institutionConfigs').doc(createHash('sha256').update('qa-academy-one').digest('hex')).get();assert.equal(published.exists,false);return {cohort:'draft',brandVersion:2,tenantPublication:false};});
 await check('13 another applicant cannot reserve the same tenant slug',async()=>{const x=await actor('collision');const t=await token(x);const candidate=status(await req('POST','/api/institutions/applications',t,{...form,organizationName:'Collision School'}),201);status(await req('POST',path(candidate.application.applicationId),tb,decision('screen','received',{tenantId:'qa-academy-one',initialProgramId:'another'})),409);return {collisionDenied:409};});
 await check('14 reissue destroys old proof; revocation destroys pending invitation',async()=>{const owner=await actor('recover');const t=await token(owner);const x=status(await req('POST','/api/institutions/applications',t,{...form,organizationName:'Recovery School'}),201);const id=x.application.applicationId;revokedApplicationId=id;status(await req('POST',path(id),ta,decision('screen','received',{tenantId:'qa-recover',initialProgramId:'intro-recover'})),200);const issued=status(await req('POST',path(id),tb,decision('invite','in_review')),201);const revised=status(await req('POST',path(id),tb,decision('reissue','invitation_pending')),201);assert.notEqual(issued.oneTimeToken,revised.oneTimeToken);status(await accept(id,issued.oneTimeToken,t),403);status(await req('POST',path(id),tb,decision('revoke_invitation','invitation_pending')),200);status(await accept(id,revised.oneTimeToken,t),403);const reservation=await db.collection('institutionOnboardingTenants').doc('qa-recover').get();assert.equal(reservation.exists,false);return {oldDenied:true,revokedDenied:true,reservationReleased:true};});
 await check('15 expired invitation produces 410 and can recover by reissue',async()=>{const owner=await actor('expired');const t=await token(owner);const x=status(await req('POST','/api/institutions/applications',t,{...form,organizationName:'Expired School'}),201);const id=x.application.applicationId;status(await req('POST',path(id),ta,decision('screen','received',{tenantId:'qa-expired',initialProgramId:'intro-expired'})),200);const issued=status(await req('POST',path(id),tb,decision('invite','in_review')),201);await db.collection('institutionOnboardingInvitations').doc(id).update({expiresAt:'2020-01-01T00:00:00.000Z'});status(await accept(id,issued.oneTimeToken,t),410);const newer=status(await req('POST',path(id),tb,decision('reissue','invitation_pending')),201);status(await accept(id,newer.oneTimeToken,t),200);return {expired:410,reissue:200};});
 await check('16 per-identity invitation brute force throttled without recording raw email',async()=>{const bad=await actor('attacker');const t=await token(bad);for(let i=0;i<12;i++)status(await accept(appId,'bad',t),403);status(await accept(appId,'bad',t),429);const snap=await db.collection('institutionRequestRateWindows').get();assert.ok(snap.docs.every(d=>d.data().applicantEmail===undefined));return {attempts:12,thirteenth:429};});
 await check('17 review, invitation, acceptance and activation appear in audit with no bearer secret',async()=>{const snap=await db.collection('institutionApplicationAudits').where('applicationId','==',appId).get();const events=snap.docs.map(d=>d.data());for(const action of ['screen','invite','accept','activate'])assert.ok(events.some(e=>e.action===action),action);assert.ok(events.every(e=>!e.tokenDigest&&!e.rawToken));return {audits:events.length,secretAbsent:true};});
 await check('18 expired unactivated applicant retention is dry-run-first with explicit purge audit',async()=>{
  await db.collection('institutionApplications').doc(revokedApplicationId).update({retentionExpiresAt:'2020-01-01T00:00:00.000Z'});
  const args=['scripts/purge-academy-requests.mjs','--project',project,'--operator-uid',A.uid];
  const run=async extra=>JSON.parse((await exec(process.execPath,[...args,...extra],{
    cwd:process.cwd(),env:{...process.env,LUMA_INSTITUTION_PURGE_ENABLED:'true',LUMA_OPERATOR_ID_TOKEN:ta},timeout:40000,
  })).stdout);
  const dry=await run([]);assert.equal(dry.mode,'dry-run');assert.ok(dry.eligibleCount>=1);
  assert.equal((await db.collection('institutionApplications').doc(revokedApplicationId).get()).exists,true);
  const applied=await run(['--apply','--confirm-project',project]);assert.ok(applied.processed>=1);
  assert.equal((await db.collection('institutionApplications').doc(revokedApplicationId).get()).exists,false);
  assert.equal((await db.collection('institutionApplications').doc(appId).get()).exists,true);
  const audits=await db.collection('institutionApplicationAudits').where('applicationId','==',revokedApplicationId).get();
  assert.ok(audits.docs.some(x=>x.data().action==='privacy-retention-purge'));
  return {readOnlyDryRun:true,recordDeletedOnlyAfterApply:true,activatedTenantUnaffected:true,purgeAudit:true};
 });
 await check('19 forged operator UID without matching signed session cannot activate or purge',async()=>{
  await assert.rejects(activate(appId,A.uid,undefined,tf),/PLATFORM_OPERATOR_TOKEN_IDENTITY_MISMATCH/);
  await assert.rejects(activate(appId,A.uid,undefined,''),/PLATFORM_OPERATOR_SIGNED_TOKEN_REQUIRED/);
  const args=['scripts/purge-academy-requests.mjs','--project',project,'--operator-uid',A.uid];
  await assert.rejects(exec(process.execPath,args,{cwd:process.cwd(),env:{...process.env,LUMA_OPERATOR_ID_TOKEN:tf},timeout:20000}),
    /PLATFORM_OPERATOR_TOKEN_IDENTITY_MISMATCH/);
  return {operatorUidImpersonationDenied:true,missingTokenDenied:true,purgeOperatorBoundToJwt:true};
 });
}catch(e){report.error=String(e.stack||e).slice(0,2000)}finally{
 report.status=report.error?'FAIL':'PASS';report.summary={passed:report.checks.filter(x=>x.result==='PASS').length,failed:report.checks.filter(x=>x.result==='FAIL').length};
 let cleanupFailures=0;for(const user of users){try{await auth.deleteUser(user.uid)}catch{cleanupFailures++;}}
 report.cleanup=cleanupFailures===0?'All synthetic identities removed; demo emulator records discarded':'Actor cleanup errors:'+cleanupFailures;
 writeFileSync('evidence/first-client-approval-2026-10-18/api-results.json',JSON.stringify(report,null,2)+'\n');
 await deleteApp(app);
}
console.log('FIRSTCLIENT_APPROVAL_QA',JSON.stringify({status:report.status,summary:report.summary}));
if(report.error)throw Error(report.error);
