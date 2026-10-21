/**
 * LUMA authenticated real-browser/business-API/local-provider E2E.
 * Must run only with ephemeral Firebase Auth + Firestore demo emulators.
 * No real Google identity, customer data, LiveKit Cloud credentials, or production writes.
 */
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { chromium } from '@playwright/test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { RoomServiceClient } from 'livekit-server-sdk';

const projectId = 'demo-luma-live-uat';
const baseUrl = 'http://127.0.0.1:3462';
const providerHttp = 'https://127.0.0.1:7985';
const providerWs = 'wss://127.0.0.1:7985';
const authHost = '127.0.0.1:9462';
const firestoreHost = '127.0.0.1:8462';
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== authHost ||
    process.env.FIRESTORE_EMULATOR_HOST !== firestoreHost ||
    process.env.GOOGLE_CLOUD_PROJECT !== projectId ||
    process.env.LIVEKIT_URL !== providerWs ||
    process.env.LIVEKIT_API_KEY !== 'devkey' ||
    process.env.LIVEKIT_API_SECRET !== 'secret' ||
    !process.env.NODE_EXTRA_CA_CERTS?.startsWith('/tmp/luma-two-students-uat-tls/')) {
  throw new Error('REFUSED: demo Firebase Auth/Firestore and local-loopback LiveKit TLS required');
}
const id=randomUUID().replaceAll('-', '').slice(0,12);
const tenantId='qa_tenant_'+id;
const programId='qa_prog_'+id;
const cohortKey='qa_cohort_'+id;
const sessionId='qa_session_'+id;
const outputDir='evidence/live-classroom-acceptance/two-students-auth-e2e-20261020';
mkdirSync(outputDir,{recursive:true});
const actions=[];
const report={
  startedAt:new Date().toISOString(),
  kind:'AUTHENTICATED_LUMA_BROWSER_AND_API_WITH_REAL_LOCAL_OSS_WEBRTC_NOT_CLOUD',
  productSourceBeforeQaPatch:'7effcd08e7df429e6f219d0df40e3d3ce8b0cd23',
  qaSourceSha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  projectId,actors:['admin','instructor','learner-a','learner-b','unauthorized'],
  sourceFeatureFlags:'QA_ONLY_DEV_LOCALHOST_Firebase_Emulator',
  provider:'LiveKit OSS 1.13.10 via loopback TLS (synthetic media)',
  results:actions, overall:'INCOMPLETE', cloudAcceptance:'NOT_TESTED'
};
const adminApp=initializeApp({projectId},'qa-students-'+id);
const auth=getAuth(adminApp), db=getFirestore(adminApp);
const livekit=new RoomServiceClient(providerHttp,'devkey','secret');
const accounts={};
let dev, browser, contexts=[], roomName, offeringId, grantA,grantB,wasRoomCreated=false;
function record(name,result,more={}) {
  actions.push({name,result,at:new Date().toISOString(),...more});
  process.stdout.write('QA_CASE '+name+' '+result+'\n');
}
function safeError(error) {
  const e=error instanceof Error?error.message:String(error);
  // Never print raw token, password, email, UID or localhost authorization material.
  return e.replace(/eyJ[A-Za-z0-9_\-.]{30,}/g,'[JWT]').replace(/[a-z0-9_.+%-]+@[a-z0-9.-]+/gi,'[EMAIL]').slice(0,350);
}
async function readJson(response) {
  const text=await response.text();
  try{return JSON.parse(text);} catch{return {unparsed:text.slice(0,150)}}
}
async function api(role,path,{method='GET',body}={}) {
  const headers={'cache-control':'no-cache'};
  if(accounts[role]?.token) headers.authorization='Bearer '+accounts[role].token;
  if(body!==undefined) headers['content-type']='application/json';
  const response=await fetch(baseUrl+path,{method,headers,
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  return {status:response.status,body:await readJson(response)};
}
function assert(cond,message) { if(!cond)throw new Error(message); }
async function callApi(role,path,body,expected=[200,201]) {
  const result=await api(role,path,{method:'POST',body});
  assert(expected.includes(result.status),
    'API '+path+' status '+result.status+': '+JSON.stringify(result.body).slice(0,250));
  return result.body;
}
async function signInEmulator(email,password) {
  const response=await fetch('http://'+authHost+
    '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    {method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email,password,returnSecureToken:true})});
  const body=await readJson(response);
  assert(response.ok && typeof body.idToken==='string','Emulator account sign-in failed');
  return body.idToken;
}
async function seedUser(role,claims={}) {
  const email='luma-qa-'+role+'-'+id+'@example.test';
  const password='synthetic-'+randomUUID()+'-QA';
  const user=await auth.createUser({email,password,emailVerified:true,
    displayName:{admin:'QA Admin',instructor:'QA Instructor','learner-a':'QA Alumno A',
      'learner-b':'QA Alumno B',unauthorized:'QA Sin Matrícula'}[role]});
  if(Object.keys(claims).length) await auth.setCustomUserClaims(user.uid,claims);
  accounts[role]={email,password,uid:user.uid};
  accounts[role].token=await signInEmulator(email,password);
}
async function healthcheck() {
  const deadline=Date.now()+90000;
  let last='';
  while(Date.now()<deadline) {
    if(dev?.exitCode !== null && dev?.exitCode!==undefined)throw new Error('Next development server terminated');
    try{
      const response=await fetch(baseUrl+'/login',{signal:AbortSignal.timeout(6000)});
      if(response.ok)return;
      last='HTTP '+response.status;
    }catch(e){last=e?.message??'unknown';}
    await new Promise(resolve=>setTimeout(resolve,1400));
  }
  throw new Error('Next dev did not serve login after 90s: '+last.slice(0,80));
}
async function loginBrowser(role,url) {
  const ctx=await browser.newContext({permissions:['microphone','camera'],
    ignoreHTTPSErrors:true,viewport:{width:1360,height:900}});
  contexts.push(ctx);
  const page=await ctx.newPage();
  page.on('pageerror',error=>{
    const msg=safeError(error);
    if(/firebase|livekit|room|permission|auth|TypeError/i.test(msg))
      process.stdout.write('BROWSER_ERROR '+role+' '+msg+'\n');
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>typeof window.__lumaQaEmailSignIn==='function',null,{timeout:20000});
  await page.evaluate(async ({email,password})=>{
    await window.__lumaQaEmailSignIn(email,password);
  },{email:accounts[role].email,password:accounts[role].password});
  await page.getByRole('heading',{name:/Prepárate para una experiencia en vivo/i})
    .waitFor({timeout:25000});
  record('browser-login-'+role,'PASS',{authenticatedVia:'Firebase Auth Emulator'});
  return page;
}
async function joinBrowser(role,url) {
  const page=await loginBrowser(role,url);
  const pre=page.getByRole('button',{name:/Entrar a mi aula/i});
  await pre.waitFor({timeout:25000});
  await pre.click();
  try {
    await page.getByTestId('live-classroom-media').waitFor({state:'visible',timeout:30000});
  } catch(e) {
    const diagnostic={
      buttons:(await page.locator('button').evaluateAll(els=>els.map(x=>({text:x.textContent?.trim().slice(0,50),label:x.getAttribute('aria-label')})).slice(0,25))),
      alert:(await page.getByRole('alert').allTextContents()).map(x=>x.slice(0,100)),
      headings:(await page.getByRole('heading').allTextContents()).map(x=>x.slice(0,100))
    };
    process.stdout.write('DIAGNOSTIC '+role+' '+JSON.stringify(diagnostic)+'\n');
    throw e;
  }
  record('branded-luma-ui-join-'+role,'PASS',{uiTestId:'live-classroom-media'});
  return page;
}
function mediaRoom(tenant,offering,session) {
  return 'luma_'+createHash('sha256').update(JSON.stringify([tenant,offering,session])).digest('hex');
}
async function rosterAtLeast(min) {
  const deadline=Date.now()+16000;
  let last=[];
  while(Date.now()<deadline){
    last=await livekit.listParticipants(roomName);
    if(last.length>=min)return last;
    await new Promise(resolve=>setTimeout(resolve,300));
  }
  throw new Error('expected '+min+' media peers, got '+last.length);
}
try {
  const devLog=createWriteStream(outputDir+'/next-dev-local.log',{flags:'w'});
  dev=spawn('node_modules/.bin/next',['dev','--webpack','--hostname','127.0.0.1','--port','3462'],{
    cwd:process.cwd(),env:{...process.env,
      NEXT_PUBLIC_LUMA_QA_PROJECT:projectId,
      NEXT_PUBLIC_LUMA_QA_AUTH_HOST:authHost,
      LUMA_LIVE_CLASSROOM_ENABLED:'true',
      LIVEKIT_URL:providerWs,
      LIVEKIT_API_KEY:'devkey',LIVEKIT_API_SECRET:'secret',
      NEXT_TELEMETRY_DISABLED:'1',
      GOOGLE_CLOUD_PROJECT:projectId,
      FIREBASE_AUTH_EMULATOR_HOST:authHost,
      FIRESTORE_EMULATOR_HOST:firestoreHost},
    stdio:['ignore','pipe','pipe']
  });
  dev.stdout.pipe(devLog);dev.stderr.pipe(devLog);
  await healthcheck();
  record('isolated-dev-and-emulator-provider','PASS');
  // Next.js --webpack compiles each dynamic route on first use. A cold compile
  // has taken 46s in this sandbox, but the handler still returned HTTP 200.
  // Prewarm the exact API route with an *unauthenticated* 401-only request;
  // never mutate state or issue provider credentials as part of prewarming.
  const coldRouteStartedAt=Date.now();
  const warmup=await fetch(baseUrl+'/api/live/classrooms/'+
    'a'.repeat(64)+'/qa_prewarm/interaction',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({action:'set_hand',raised:true}),
      signal:AbortSignal.timeout(90000)
    });
  assert(warmup.status===401,'Unauthenticated prewarm did not deny control action');
  record('cold-interaction-route-prewarmed-anonymously','PASS',
    {coldRouteCompileAndGuardMs:Date.now()-coldRouteStartedAt});
  await seedUser('admin',{admin:true,role:'admin',adminTenantIds:[tenantId]});
  await seedUser('instructor',{role:'coach',coach:true,tenantIds:[tenantId]});
  await seedUser('learner-a');
  await seedUser('learner-b');
  await seedUser('unauthorized');
  record('created-five-synthetic-firebase-auth-users','PASS',{admin:1,instructor:1,learners:2,unauthorized:1,project:'demo-luma-live-uat'});
  const created=await callApi('admin','/api/programs/admin/offerings',{
    tenantId,programId,cohortKey,title:'LUMA clase sintética QA',deliveryMode:'live',
    timezone:'America/Guatemala',status:'active',coachIds:[accounts.instructor.uid]
  });
  offeringId=created.offering?.offeringId;
  assert(/^[a-f0-9]{64}$/.test(offeringId??''),'admin offering ID missing');
  record('admin-created-live-offering-api','PASS');
  const scheduled=await callApi('admin',`/api/programs/admin/offerings/${offeringId}/sessions`,{
    sessionId,title:'Clase de 90 minutos QA',startsAt:new Date(Date.now()+15_000).toISOString(),
    durationMinutes:90,classroomProvider:'livekit',classroomCapacity:10,
    recordingPolicy:'none',status:'scheduled'
  });
  assert(scheduled.session?.sessionId===sessionId,'admin schedule did not persist');
  record('admin-scheduled-90-minute-no-recording','PASS');
  for(const role of ['learner-a','learner-b']) {
    const answer=await callApi('admin','/api/enrollments/institutional',{
      tenantId,programId,offeringId,email:accounts[role].email,
      reason:'Autorización sintética para pruebas E2E empresariales en emuladores aislados.',
      expiresAt:new Date(Date.now()+86400000).toISOString(),allowReactivation:false
    });
    assert(answer.enrollment?.status==='active','institutional grant did not activate');
    if(role==='learner-a')grantA=answer.enrollment.enrollmentId;
    else grantB=answer.enrollment.enrollmentId;
  }
  record('admin-granted-two-institutional-enrollments','PASS');
  const unauth=await api('unauthorized',`/api/live/classrooms/${offeringId}/${sessionId}/token`,{method:'POST'});
  assert(unauth.status===403,'unassigned user should be denied but got '+unauth.status);
  record('unauthorized-emulated-user-classroom-denied','PASS',{http:unauth.status});
  const learnerAdminAttempt=await api('learner-b',`/api/programs/admin/offerings?tenantId=${tenantId}`);
  assert(learnerAdminAttempt.status===403,'learner could query admin offerings');
  record('learner-admin-api-access-denied','PASS',{http:learnerAdminAttempt.status});
  roomName=mediaRoom(tenantId,offeringId,sessionId);
  browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',
    args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required','--ignore-certificate-errors']});
  const url=`${baseUrl}/classroom/${offeringId}/${sessionId}`;
  const pages={};
  for(const role of ['instructor','learner-a','learner-b']){
    pages[role]=await joinBrowser(role,url);
  }
  let roster=await rosterAtLeast(3);wasRoomCreated=true;
  record('three-provider-participants-connected','PASS',{count:roster.length});
  // Exercise the actual LUMA VideoConference controls: real microphone and
  // camera tracks, not merely a successful signaling connection.
  for(const role of ['instructor','learner-a','learner-b']){
    const page=pages[role];
    const mic=page.getByRole('button',{name:/^microphone$/i});
    const cam=page.getByRole('button',{name:/^camera$/i});
    if(await mic.count()!==1 || await cam.count()!==1) {
      const controls=await page.locator('button').evaluateAll(nodes=>nodes.map(n=>({
        aria:n.getAttribute('aria-label'),text:n.textContent?.trim().slice(0,40)
      })).slice(0,25));
      throw new Error('Cannot uniquely locate media controls for '+role+': '+JSON.stringify(controls));
    }
    await mic.click();
    await cam.click();
    record('real-luma-toolbar-camera-microphone-on-'+role,'PASS');
  }
  const publishDeadline=Date.now()+25000;
  while(Date.now()<publishDeadline){
    roster=await livekit.listParticipants(roomName);
    if(roster.length===3 && roster.every(p=>p.tracks.length>=2))break;
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  assert(roster.length===3 && roster.every(p=>p.tracks.length>=2),
    'Not all three authenticated participants published actual microphone and camera tracks');
  record('three-provider-real-audio-and-video-publishers','PASS',
    {count:roster.length,tracks:roster.map(p=>p.tracks.length)});
  for(const role of ['instructor','learner-a','learner-b']){
    const page=pages[role];
    await page.waitForFunction(()=>
      [...document.querySelectorAll('video')].filter(v=>
        v.readyState>=2 && v.videoWidth>0 && v.videoHeight>0).length>=2,
      undefined,{timeout:22000});
    const decoded=await page.evaluate(()=>
      [...document.querySelectorAll('video')].filter(v=>
        v.readyState>=2 && v.videoWidth>0 && v.videoHeight>0).length);
    record('real-browser-decodes-media-'+role,'PASS',{decodedVideoElements:decoded});
  }
  for(const role of ['instructor','learner-a','learner-b']){
    const p=pages[role];
    const safe=role.replace(/[^a-z-]/g,'');
    await p.screenshot({path:`${outputDir}/${safe}-luma-connected.png`,fullPage:true});
  }
  // Instructional hand UI is wired to Firebase Auth + Firestore + actual LiveKit attributes.
  const learnerHand=pages['learner-a'].getByRole('button',{name:'Levantar la mano'});
  await learnerHand.waitFor({timeout:20000});
  const handStartedAt=Date.now();
  await learnerHand.click();
  // On an isolated cold Next/Firebase emulation run, the server API request may
  // compile on first use. Do not mistake a slow confirmed response for an
  // unsuccessful action: wait for the exact, server-confirmed UI state and
  // retain observed latency for QA analysis. No artificial PASS on timeout.
  await pages['learner-a'].getByRole('button',{name:'Bajar la mano'}).waitFor({timeout:30000});
  record('learner-a-raises-hand-through-real-branded-ui','PASS',
    {actionConfirmationMs:Date.now()-handStartedAt});
  const ack=pages.instructor.getByRole('button',{name:/Bajar la mano de QA Alumno A/});
  await ack.waitFor({timeout:25000});
  const acknowledgeStartedAt=Date.now();
  await ack.click();
  await pages.instructor.getByText('Mano atendida y bajada para el participante.').waitFor({timeout:30000});
  record('instructor-acknowledges-hand-through-real-ui','PASS', {actionConfirmationMs:Date.now()-acknowledgeStartedAt});
  pages.instructor.once('dialog',dialog=>dialog.accept());
  await pages.instructor.getByRole('button',{name:'Silenciar micrófonos'}).click();
  await pages.instructor.getByText(/Se silenciaron 2 micrófonos/).waitFor({timeout:30000});
  record('instructor-real-ui-mutes-both-students','PASS');
  // The classroom promises that learners can unmute themselves after instructor moderation.
  const learnerBMic=pages['learner-b'].getByRole('button',{name:/^microphone$/i});
  await learnerBMic.click();
  const expectedB='p_'+createHash('sha256').update(JSON.stringify([
    roomName,accounts['learner-b'].uid])).digest('hex');
  let bRestored=false;
  const restoreDeadline=Date.now()+12000;
  while(Date.now()<restoreDeadline) {
    const current=await livekit.listParticipants(roomName);
    const member=current.find(p=>p.identity===expectedB);
    if(member?.tracks.some(t=>t.type===0 && t.muted===false)){bRestored=true;break;}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  if(!bRestored) {
    // Toggle can require a second click if the provider initiated mute changes
    // the publication state before the local control is synchronized.
    await learnerBMic.click();
    const retry=await livekit.listParticipants(roomName);
    bRestored=Boolean(retry.find(p=>p.identity===expectedB)?.tracks.some(t=>t.type===0 && t.muted===false));
  }
  assert(bRestored,'Learner B cannot restore their own microphone after instructor mute');
  record('learner-b-restores-own-microphone-after-instructor-mute','PASS');
  // Check learner cannot call instructor control through their authenticated JWT.
  const forbidden=await api('learner-b',`/api/live/classrooms/${offeringId}/${sessionId}/interaction`,
    {method:'POST',body:{action:'mute_all'}});
  assert(forbidden.status===403,'learner instructor moderation was not rejected');
  record('learner-instructor-only-action-denied','PASS',{http:forbidden.status});
  const mobile=pages['learner-b'];
  await mobile.setViewportSize({width:375,height:812});
  await mobile.waitForTimeout(250);
  const mobileMetrics=await mobile.evaluate(() => {
    const stage=document.querySelector('[data-testid="live-classroom-media"]');
    const dock=stage?.querySelector('.lk-control-bar');
    const hand=stage?.querySelector('button[aria-label="Levantar la mano"]');
    return {
      width:window.innerWidth,
      scrollWidth:document.documentElement.scrollWidth,
      dockBottomGap:stage&&dock?Math.round(
        stage.getBoundingClientRect().bottom-dock.getBoundingClientRect().bottom):null,
      handDockSeparation:hand&&dock?Math.round(
        dock.getBoundingClientRect().top-hand.getBoundingClientRect().bottom):null,
      barButtons:[...document.querySelectorAll('.lk-control-bar button')]
        .filter(node=>getComputedStyle(node).display!=='none')
        .map(node=>({width:Math.round(node.getBoundingClientRect().width),
          height:Math.round(node.getBoundingClientRect().height),
          visible:node.getBoundingClientRect().width>0}))
    };
  });
  assert(mobileMetrics.scrollWidth<=mobileMetrics.width+1,'Mobile page has horizontal overflow');
  assert(mobileMetrics.barButtons.length>=3,'Mobile LiveKit control bar missing');
  assert(mobileMetrics.barButtons.every(button=>button.width>=44 && button.height>=44),
    'Mobile media dock has touch controls smaller than 44x44 px');
  assert(typeof mobileMetrics.dockBottomGap==='number' &&
    mobileMetrics.dockBottomGap>=0 && mobileMetrics.dockBottomGap<=36,
    'Liquid Glass dock not aligned with the bottom of mobile media stage: '+
    JSON.stringify(mobileMetrics));
  assert(typeof mobileMetrics.handDockSeparation==='number' &&
    mobileMetrics.handDockSeparation>=5,
    'Mobile hand-raise button overlaps bottom media controls: '+
    JSON.stringify(mobileMetrics));
  await mobile.screenshot({path:outputDir+'/learner-b-375x812-live.png',fullPage:true});
  record('authenticated-mobile-375x812-controls','PASS',{
    viewport:'375x812',buttonCount:mobileMetrics.barButtons.length,
    dockBottomGap:mobileMetrics.dockBottomGap,
    handDockSeparation:mobileMetrics.handDockSeparation});
  await mobile.setViewportSize({width:1360,height:900});
  await pages.instructor.screenshot({path:`${outputDir}/instructor-after-hand.png`,fullPage:true});
  // Institutional administration executes a real business revocation against an already-connected WebRTC peer.
  const revokedAt=Date.now();
  const revoke=await callApi('admin','/api/enrollments/institutional/'+grantA,{
    tenantId,reason:'Revocación QA autorizada durante una clase con alumno conectado.'
  });
  assert(revoke.status==='revoked','institutional revocation not persisted');
  const revokedDoneAt=Date.now();
  const ridA='p_'+createHash('sha256').update(JSON.stringify([roomName,accounts['learner-a'].uid])).digest('hex');
  const deadline=Date.now()+14000;
  let left=false;
  while(Date.now()<deadline){
    roster=await livekit.listParticipants(roomName);
    if(roster.length===2&&!roster.some(p=>p.identity===ridA)){left=true;break;}
    await new Promise(resolve=>setTimeout(resolve,350));
  }
  assert(left,'revoked learner still connected after provider dispatch');
  assert(roster.length===2,'another authorized peer disconnected');
  const denied=await api('learner-a',`/api/live/classrooms/${offeringId}/${sessionId}/token`,{method:'POST'});
  assert(denied.status===403,'revoked learner can still mint a LUMA token: '+denied.status);
  record('institutional-revocation-evicts-connected-learner-a','PASS',{
    apiElapsedMs:revokedDoneAt-revokedAt,remainingMediaPeers:2,
    revokedLearnerTokenHttp:denied.status});
  await pages['learner-a'].screenshot({path:`${outputDir}/learner-a-after-revocation.png`,fullPage:true});
  const state=await db.collection('commerceEnrollments').doc(grantA).get();
  assert(state.get('status')==='revoked','Firestore entitlement not persisted revoked');
  const roomDoc=await db.collection('liveClassroomRooms').doc(roomName)
    .collection('authorized').doc(ridA).get();
  assert(Boolean(roomDoc.get('bannedAt')),'durable roster ban missing');
  record('firestore-entitlement-and-roster-ban-persisted','PASS');
  // Known difference: OSS JWT replay is outside LUMA API and is not Cloud acceptance.
  record('cloud-old-jwt-replay','BLOCKED',{reason:'No approved Cloud project; local OSS has documented old-JWT replay limitation'});
  const instructorRemaining=pages.instructor.getByTestId('live-classroom-media');
  await instructorRemaining.waitFor({state:'visible',timeout:6000});
  await pages['learner-b'].getByTestId('live-classroom-media').waitFor({state:'visible',timeout:6000});
  record('instructor-and-second-learner-preserved-after-revocation','PASS');
  const finished=await api('instructor',`/api/live/classrooms/${offeringId}/${sessionId}/close`,{method:'POST'});
  assert(finished.status===200,'instructor failed to close class '+finished.status);
  record('instructor-closes-class-for-everyone','PASS');
  const admissionAfter=await api('learner-b',`/api/live/classrooms/${offeringId}/${sessionId}/token`,{method:'POST'});
  assert(admissionAfter.status===409,'learner admitted after class closure');
  record('no-new-admission-after-close','PASS',{http:admissionAfter.status});
  report.overall='PASS_LOCAL_AUTHENTICATED_LUMA_BUSINESS_UI_WITH_LIVEKIT_OSS_CLOUD_PENDING';
} catch(error) {
  report.overall='FAIL';
  report.error=safeError(error);
  record('test-failed','FAIL',{reason:report.error});
} finally {
  report.finishedAt=new Date().toISOString();
  report.executedCases=actions.length;
  report.passCount=actions.filter(a=>a.result==='PASS').length;
  report.failCount=actions.filter(a=>a.result==='FAIL').length;
  report.blockedCount=actions.filter(a=>a.result==='BLOCKED').length;
  try{
    if(wasRoomCreated && roomName)await livekit.deleteRoom(roomName);
  }catch{}
  await Promise.allSettled(contexts.map(ctx=>ctx.close()));
  if(browser)await browser.close();
  if(dev){dev.kill('SIGTERM');await new Promise(r=>setTimeout(r,400));if(dev.exitCode===null)dev.kill('SIGKILL');}
  await deleteApp(adminApp);
  writeFileSync(outputDir+'/authenticated-e2e-result.json',JSON.stringify(report,null,2)+'\n');
  console.log('QA_FINAL '+JSON.stringify({overall:report.overall,pass:report.passCount,
    fail:report.failCount,blocked:report.blockedCount,error:report.error??null}));
}
if(report.overall==='FAIL')process.exitCode=1;
