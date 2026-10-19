import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const project = process.env.GCLOUD_PROJECT || "";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "";
const storeHost = process.env.FIRESTORE_EMULATOR_HOST || "";
const base = "http://127.0.0.1:3151";
const tenant = "qa-tenant-a";
const program = "qa-program-a";
if (!project.startsWith("demo-") || !authHost.startsWith("127.0.0.1:") ||
    !storeHost.startsWith("127.0.0.1:") ||
    process.env.LUMA_LEARNING_ACCESS_MODE !== "entitled" ||
    process.env.LUMA_LEARNING_TENANT_ID !== tenant ||
    process.env.LUMA_LEARNING_PROGRAM_ID !== program) {
  throw new Error("QA_MUST_USE_LOCAL_DEMO_AUTH_AND_FIRESTORE");
}

const app = initializeApp({ projectId: project }, "luma-cxh-"+randomUUID());
const auth = getAuth(app), db = getFirestore(app);
const users = [], enrollmentRefs = [];
const temporaryPassword = "Emulator!" + randomUUID() + "aA9";
const results = { source: "Firebase Auth/Firestore emulators only", project, outcomes: {}, cleanup: "pending" };
function ok(label, code) { results.outcomes[label] = code; }
async function json(r) { return { status:r.status, body:await r.json() }; }
async function api(method,path,bearer,data,headers={}) {
  const h={...headers};
  if(bearer) h.authorization="Bearer "+bearer;
  if(data!==undefined) h["content-type"]="application/json";
  return json(await fetch(base+path,{method,headers:h,...(data===undefined?{}:{body:JSON.stringify(data)})}));
}
async function actor(label,claims) {
  const a=await auth.createUser({email:"cxh-"+label+"-"+randomUUID()+"@example.test",
    emailVerified:true,password:temporaryPassword});
  users.push(a);
  if(claims) await auth.setCustomUserClaims(a.uid,claims);
  return a;
}
async function token(a) {
  const r=await json(await fetch("http://"+authHost+"/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=qa-demo",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({email:a.email,password:temporaryPassword,returnSecureToken:true}),
  }));
  assert.equal(r.status,200,"demo auth sign-in");
  return r.body.idToken;
}
async function grant(uid,tid=tenant,pid=program) {
  const id="cxh-"+randomUUID(), now=new Date().toISOString();
  const ref=db.collection("commerceEnrollments").doc(id);
  enrollmentRefs.push(ref);
  await ref.set({enrollmentId:id,entitlementId:id,tenantId:tid,programId:pid,
    learnerId:uid,productId:"qa-institutional-offering",customerId:"qa-disposable",
    enrollmentSource:"institutional",status:"active",createdAt:now,updatedAt:now,
    lastProvider:"hotmart",lastProviderEventId:"qa-"+id,lastEventAt:now});
  return ref;
}
async function run() {
  const learner=await actor("learner"), outsider=await actor("other-tenant");
  const coach=await actor("coach",{role:"coach",coachTenantIds:[tenant]});
  const foreignCoach=await actor("foreign-coach",{role:"coach",coachTenantIds:["qa-tenant-b"]});
  const ordinary=await actor("ordinary");
  const entitlement=await grant(learner.uid);
  await grant(outsider.uid,"qa-tenant-b");
  const lt=await token(learner), ot=await token(outsider), ct=await token(coach);
  const ft=await token(foreignCoach), ut=await token(ordinary);
  let r=await api("GET","/api/learning/plan");
  assert.equal(r.status,401);ok("guest_denied",401);
  r=await api("GET","/api/learning/plan",ot);
  assert.equal(r.status,403);ok("foreign_learner_denied",403);
  r=await api("GET","/api/learning/plan",lt);
  assert.equal(r.status,404);ok("entitled_empty_state",404);
  r=await api("PUT","/api/learning/plan",lt,{onboarding:{
    goal:"emotions",diagnostic:"b",confidence:2,minutes:12,
    createdAt:"2026-10-10T15:00:00.000Z"}});
  assert.equal(r.status,200,JSON.stringify(r.body).slice(0,300));
  assert.equal(r.body.persistence.source,"firestore");
  assert.equal(r.body.persistence.version,1);
  const before=r.body.plan.nextAction.id;ok("entitled_onboarding",200);
  const eventId="qa-"+randomUUID();
  const event={type:"SIMULATION_COMPLETED",conceptId:"pas",correctCount:0,
    answers:{thought:"pas",emotion:"shame",reframe:"balanced"},
    attempts:{thought:1,emotion:1,reframe:1},
    completedAt:"2026-10-10T15:05:00.000Z",sourceId:"qa-rubric-pas-v1"};
  r=await api("POST","/api/learning/events",lt,{eventId,event});
  assert.equal(r.status,200,JSON.stringify(r.body).slice(0,300));
  assert.equal(r.body.persistence.version,2);
  const nextAction=r.body.plan.nextAction.id;
  assert.notEqual(nextAction,before);ok("rubric_receipt_version_2",200);
  r=await api("POST","/api/learning/events",lt,{eventId,event});
  assert.equal(r.status,200);assert.equal(r.body.duplicate,true);
  assert.equal(r.body.persistence.version,2);ok("idempotent_replay",200);
  // Fresh ID token, separate HTTP exchange: no localStorage proof shortcut.
  const newToken=await token(learner);
  r=await api("GET","/api/learning/plan",newToken);
  assert.equal(r.status,200);assert.equal(r.body.persistence.version,2);
  assert.equal(r.body.persistence.lastEventId,eventId);
  assert.equal(r.body.plan.nextAction.id,nextAction);ok("fresh_session_readback",200);
  r=await api("GET","/api/learning/plan",newToken,undefined,{"x-luma-program-id":"qa-other-program"});
  assert.equal(r.status,403);ok("unentitled_program_denied",403);
  r=await api("GET","/api/coach/learners",ut);
  assert.equal(r.status,403);ok("ordinary_coach_denied",403);
  r=await api("GET","/api/coach/learners",ct);
  assert.equal(r.status,200,JSON.stringify(r.body).slice(0,300));
  assert.ok(r.body.learners.some(x=>x.learnerId===learner.uid));ok("scoped_coach_roster",200);
  r=await api("GET","/api/coach/learners/"+encodeURIComponent(learner.uid),ct);
  assert.equal(r.status,200);assert.equal(r.body.record.version,2);
  assert.ok(r.body.events.some(x=>x.eventId===eventId&&x.rubricId&&x.criteria?.length===3));
  ok("coach_rubric_provenance",200);
  r=await api("GET","/api/coach/learners/"+encodeURIComponent(outsider.uid),ct);
  assert.equal(r.status,403);ok("cross_tenant_learner_denied",403);
  r=await api("GET","/api/coach/learners/"+encodeURIComponent(learner.uid),ft);
  assert.equal(r.status,403);ok("foreign_coach_denied",403);
  await entitlement.update({status:"revoked"});
  r=await api("POST","/api/learning/events",newToken,{eventId,event});
  assert.equal(r.status,403);ok("revoked_event_replay_denied",403);
  r=await api("GET","/api/coach/learners/"+encodeURIComponent(learner.uid),ct);
  assert.equal(r.status,403);ok("revoked_coach_read_denied",403);
}
let error;
try {await run();}
catch(e) {error=e;}
finally {
  let failedCleanup=0;
  for(const ref of enrollmentRefs){try{await ref.delete();}catch{failedCleanup++;}}
  const digest=value=>createHash("sha256").update(value).digest("hex");
  const scopedLearners=db.collection("learningTenants").doc(digest(tenant))
    .collection("learningPrograms").doc(digest(program)).collection("learners");
  for(const user of users){try{await db.recursiveDelete(scopedLearners.doc(user.uid));}catch{failedCleanup++;}}
  for(const user of users){try{await auth.deleteUser(user.uid);}catch{failedCleanup++;}}
  results.cleanup=failedCleanup===0?"PASS: QA users, entitlements and scoped learner records deleted":"PARTIAL: emulator destruction required";
  results.count=Object.keys(results.outcomes).length;
  results.verdict=error?"FAIL":"PASS";
  mkdirSync("evidence/cx-hardening-2026-10-10",{recursive:true});
  writeFileSync("evidence/cx-hardening-2026-10-10/entitled-emulator-actors.json",JSON.stringify(results,null,2)+"\n");
  await deleteApp(app);
}
if(error) throw error;
console.log(JSON.stringify(results,null,2));
