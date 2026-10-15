import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const project=process.env.GCLOUD_PROJECT||"", authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST||"", dbHost=process.env.FIRESTORE_EMULATOR_HOST||"";
const tenant="qa-first-academy", liveProgram="qa-mary-premium", everProgram="qa-mary-evergreen", base="http://127.0.0.1:3185";
if(!project.startsWith("demo-")||!authHost.startsWith("127.0.0.1:")||!dbHost.startsWith("127.0.0.1:")||
 process.env.LUMA_LEARNING_ACCESS_MODE!=="entitled"||process.env.LUMA_LEARNING_TENANT_ID!==tenant)throw Error("REFUSE_NON_EMULATOR_QA");
const app=initializeApp({projectId:project},"qa-"+randomUUID());
const auth=getAuth(app),people=[],pwd="Qa"+randomUUID().replaceAll("-","")+"-9x!";
const report={project,base:"local Firebase emulators + Next production build",sourceSHA:"7ef32ba9ff3c56896da536a86ca14286b99ddfb3",checks:[],status:"RUNNING"};
async function actor(label,claims){
 const a=await auth.createUser({email:"qa-"+label+"-"+randomUUID().slice(0,8)+"@example.test",emailVerified:true,password:pwd});
 people.push(a);if(claims)await auth.setCustomUserClaims(a.uid,claims);return a;
}
async function login(a){
 const r=await fetch("http://"+authHost+"/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=qa-demo",{
 method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:a.email,password:pwd,returnSecureToken:true})});
 const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j.idToken;
}
async function api(method,path,token,body,extra={}){
 const headers={...extra};if(token)headers.authorization="Bearer "+token;
 if(body!==undefined)headers["content-type"]="application/json";
 const r=await fetch(base+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
 const t=await r.text();let data;try{data=JSON.parse(t)}catch{data={raw:t.slice(0,100)}}
 return {status:r.status,data};
}
function code(r,n){assert.equal(r.status,n,JSON.stringify(r.data).slice(0,330));return r.data}
async function check(id,fn){
 try{const detail=await fn();report.checks.push({id,result:"PASS",detail});console.log("PASS "+id+" "+JSON.stringify(detail).slice(0,300))}
 catch(e){const error=String(e.message||e);report.checks.push({id,result:"FAIL",error:error.slice(0,400)});console.log("FAIL "+id+" "+error.slice(0,350));throw e}
}
const due=days=>new Date(Date.now()+days*86400000).toISOString();
const why="First client E2E institutional access in disposable Firebase Auth Firestore emulator";
let owner,foreign,coach,foreignCoach,learner,evergreenLearner,multi,anonymous;
let ot,ft,ct,fct,lt,et,mt,nt,live,ever,liveGrantId;
try {
 owner=await actor("owner",{role:"admin",admin:true,adminTenantIds:[tenant]});
 foreign=await actor("foreign-admin",{role:"admin",admin:true,adminTenantIds:["qa-other-tenant"]});
 coach=await actor("mary-coach",{role:"coach",coach:true,coachTenantIds:[tenant]});
 foreignCoach=await actor("foreign-coach",{role:"coach",coach:true,coachTenantIds:["qa-other-tenant"]});
 learner=await actor("learner-live");evergreenLearner=await actor("learner-evergreen");multi=await actor("learner-two-courses");anonymous=await actor("no-enrollment");
 [ot,ft,ct,fct,lt,et,mt,nt]=await Promise.all([owner,foreign,coach,foreignCoach,learner,evergreenLearner,multi,anonymous].map(login));
 await check("01 admin permissions and tenant isolation",async()=>{
  const guest=await api("GET","/api/programs/admin/offerings?tenantId="+tenant);
  const other=await api("GET","/api/programs/admin/offerings?tenantId="+tenant,ft);
  const plain=await api("GET","/api/programs/admin/offerings?tenantId="+tenant,lt);
  code(guest,401);code(other,403);code(plain,403);
  return {guest:guest.status,foreignAdmin:other.status,student:plain.status};
 });
 await check("02 Mary live and evergreen academic offerings",async()=>{
  const common={tenantId:tenant,timezone:"America/Guatemala",coachIds:[coach.uid],status:"active"};
  live=code(await api("POST","/api/programs/admin/offerings",ot,{...common,programId:liveProgram,cohortKey:"live-2026",title:"QA Mary - Programa Premium",deliveryMode:"live"}),200).offering;
  ever=code(await api("POST","/api/programs/admin/offerings",ot,{...common,programId:everProgram,cohortKey:"evergreen-2026",title:"QA Mary - Biblioteca Evergreen",deliveryMode:"asynchronous"}),200).offering;
  const roster=code(await api("GET","/api/programs/admin/offerings?tenantId="+tenant,ot),200);
  assert.ok(roster.offerings.some(o=>o.offeringId===live.offeringId));assert.ok(roster.offerings.some(o=>o.offeringId===ever.offeringId));
  return {modes:[live.deliveryMode,ever.deliveryMode],tenantOfferings:roster.offerings.length};
 });
 await check("03 Mary live classroom scheduled without recording",async()=>{
  const input={title:"QA Mary - apertura",startsAt:due(7),durationMinutes:90,classroomProvider:"livekit",classroomCapacity:25,recordingPolicy:"none"};
  const created=code(await api("POST","/api/programs/admin/offerings/"+live.offeringId+"/sessions",ot,input),200);
  assert.equal(created.session.recordingPolicy,"none");
  code(await api("POST","/api/programs/admin/offerings/"+ever.offeringId+"/sessions",ot,input),400);
  code(await api("GET","/api/programs/admin/offerings/"+live.offeringId+"/sessions",ft),403);
  return {liveSession:created.session.title,evergreenNotSchedulable:true,foreignTenantDenied:true};
 });
 await check("04 premium bulk enrollment and idempotency",async()=>{
  const body={tenantId:tenant,programId:liveProgram,offeringId:live.offeringId,reason:why,expiresAt:due(230),emails:[learner.email,multi.email,learner.email,"bad-email"]};
  const a=code(await api("POST","/api/enrollments/institutional/bulk",ot,body),200);
  assert.equal(a.summary.granted,2);assert.equal(a.summary.duplicate_input,1);assert.equal(a.summary.invalid,1);
  liveGrantId=a.rows.find(r=>r.email===learner.email).enrollmentId;
  const b=code(await api("POST","/api/enrollments/institutional/bulk",ot,body),200);
  assert.equal(b.summary.granted,0);assert.ok(b.summary.unchanged>=2);
  return {first:a.summary,replay:b.summary};
 });
 await check("05 evergreen and multiple course enrollment",async()=>{
  const shared={tenantId:tenant,programId:everProgram,offeringId:ever.offeringId,reason:why,expiresAt:due(220)};
  code(await api("POST","/api/enrollments/institutional",ot,{...shared,email:evergreenLearner.email}),201);
  code(await api("POST","/api/enrollments/institutional",ot,{...shared,email:multi.email}),201);
  const list=code(await api("GET","/api/enrollments/institutional?tenantId="+tenant,ot),200);
  assert.ok(list.records.length>=4);
  return {evergreenEnrolled:true,twoCoursesForSameLearner:true,enrollmentRecords:list.records.length};
 });
 await check("06 verified claims and correct live schedule",async()=>{
  const access=await Promise.all([lt,et,mt].map(t=>api("GET","/api/commerce/access",t)));
  access.forEach(x=>code(x,200));
  assert.equal(access[0].data.enrollments.length,1);assert.equal(access[1].data.enrollments.length,1);assert.equal(access[2].data.enrollments.length,2);
  const all=await Promise.all([lt,et,mt].map(t=>api("GET","/api/programs/my-schedule",t)));
  all.forEach(x=>code(x,200));
  assert.ok(all[0].data.schedule.some(x=>x.offeringId===live.offeringId));
  assert.equal(all[1].data.schedule.length,0);
  return {activeEnrollments:[1,1,2],sessionCounts:all.map(x=>x.data.schedule.length)};
 });
 await check("07 multi-course plan demands selection",async()=>{
  code(await api("GET","/api/learning/plan",lt),404);
  const without=await api("GET","/api/learning/plan",mt);
  code(without,409);assert.equal(without.data.error,"program_selection_required");
  code(await api("GET","/api/learning/plan",mt,undefined,{"x-luma-program-id":liveProgram}),404);
  return {noSelectionStatus:without.status,error:without.data.error,uiSelectorNotPresentInLearnHome:true};
 });
 await check("08 premium onboarding evidence survives fresh auth",async()=>{
  const init=code(await api("PUT","/api/learning/plan",lt,{onboarding:{goal:"emotions",diagnostic:"b",confidence:2,minutes:12,createdAt:due(-1)}}),200);
  assert.equal(init.persistence.source,"firestore");
  const eventId="qa-"+randomUUID();
  code(await api("POST","/api/learning/events",lt,{eventId,event:{type:"SIMULATION_COMPLETED",conceptId:"pas",answers:{thought:"pas",emotion:"shame",reframe:"balanced"},attempts:{thought:1,emotion:1,reframe:1},completedAt:new Date().toISOString(),sourceId:"qa-mary-rubric-v1"}}),200);
  const fresh=await login(learner);
  const read=code(await api("GET","/api/learning/plan",fresh),200);
  assert.equal(read.persistence.version,2);assert.equal(read.persistence.lastEventId,eventId);
  return {serverPersisted:true,version:2,restoreWithNewToken:true};
 });
 await check("09 coach evidence with scoped course; cross-tenant denial",async()=>{
  const unselected=await api("GET","/api/coach/learners",ct);
  code(unselected,409);
  const scope={"x-luma-program-id":liveProgram};
  const list=code(await api("GET","/api/coach/learners",ct,undefined,scope),200);
  assert.ok(list.learners.some(x=>x.learnerId===learner.uid));
  const view=code(await api("GET","/api/coach/learners/"+learner.uid,ct,undefined,scope),200);
  assert.equal(view.record.version,2);assert.ok(view.events.length>0);
  code(await api("GET","/api/coach/learners/"+learner.uid,fct,undefined,scope),403);
  code(await api("GET","/api/coach/learners"),401);
  return {unselectedStatus:unselected.status,authorizedCoach:true,evidenceCount:view.events.length,foreignDenied:true};
 });
 await check("10 scoped intervention insight but no outbound notification",async()=>{
  const scope={"x-luma-program-id":liveProgram};
  const s=code(await api("GET","/api/coach/interventions",ct,undefined,scope),200);
  const submit=await api("POST","/api/coach/interventions",ct,{action:"schedule-message"},scope);
  code(submit,405);
  return {signalCount:s.interventions.length,outboundHttp:submit.status};
 });
 await check("11 premium access revocation blocks learner",async()=>{
  code(await api("POST","/api/enrollments/institutional/"+liveGrantId,ot,{tenantId:tenant,reason:"QA learning entitlement immediate revocation after completion"}),200);
  code(await api("GET","/api/learning/plan",lt),403);
  const other=code(await api("GET","/api/commerce/access",mt),200);assert.equal(other.enrollments.length,2);
  return {revokedLearnerDenied:true,multiLearnerOtherProgramRetained:true};
 });
}catch(e){report.error=String(e.message||e).slice(0,500)}finally{
 report.status=report.error?"FAIL":"PASS";report.summary={passed:report.checks.filter(x=>x.result==="PASS").length,failed:report.checks.filter(x=>x.result==="FAIL").length};
 let errors=0;for(const a of people){try{await auth.deleteUser(a.uid)}catch{errors++}}
 report.cleanup=errors===0?"Deleted all test Firebase Auth users; emulator process discards temporary Firestore records":"Identity cleanup failures "+errors+"; emulator teardown still required";
 mkdirSync("evidence/first-client-e2e-2026-10-14",{recursive:true});
 writeFileSync("evidence/first-client-e2e-2026-10-14/first-client-emulator-results.json",JSON.stringify(report,null,2)+"\n");
 await deleteApp(app);
}
console.log("FINAL",JSON.stringify({status:report.status,summary:report.summary,cleanup:report.cleanup}));
if(report.error)throw Error(report.error);
