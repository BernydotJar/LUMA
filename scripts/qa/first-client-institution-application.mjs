import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const project=process.env.GCLOUD_PROJECT||"";
const authHost=process.env.FIREBASE_AUTH_EMULATOR_HOST||"";
const dbHost=process.env.FIRESTORE_EMULATOR_HOST||"";
if(!project.startsWith("demo-")||!authHost.startsWith("127.0.0.1:")||!dbHost.startsWith("127.0.0.1:")||process.env.LUMA_INSTITUTION_REQUESTS_ENABLED!=="true")throw Error("REFUSE_NON_DEMO_QA");
const base="http://127.0.0.1:3192",path="/api/institutions/applications";
const app=initializeApp({projectId:project},"intake-"+randomUUID());
const auth=getAuth(app),db=getFirestore(app),users=[];
const password="Qa"+randomUUID().replaceAll("-", "")+"Z9!";
const form={organizationName:"Academia Prueba Segura",countryCode:"GT",timezone:"America/Guatemala",deliveryMode:"hybrid",learnerRange:"51-200",contactRole:"owner"};
const report={sourceSHA:process.env.LUMA_INTAKE_SOURCE_SHA??"uncommitted-qa",environment:"local demo Firebase Auth Firestore Emulators + Next production build",project,status:"RUNNING",checks:[]};
async function actor(name,verified=true){
  const x=await auth.createUser({email:`qa-${name}-${randomUUID().slice(0,8)}@example.test`,password,emailVerified:verified});
  users.push(x);return x;
}
async function token(user){
  const r=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=qa-demo`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:user.email,password,returnSecureToken:true})});
  const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data.idToken;
}
async function call(method,identity,body,options={}){
  const headers={...(identity?{authorization:`Bearer ${identity}`}:{})};
  if(body!==undefined && options.contentType!==false)headers["content-type"]="application/json";
  const data=body===undefined?undefined:options.raw===true?body:JSON.stringify(body);
  const response=await fetch(base+(options.path??path),{method,headers,...(data===undefined?{}:{body:data})});
  const raw=await response.text();let parsed;try{parsed=JSON.parse(raw)}catch{parsed={raw:raw.slice(0,100)}}
  return {status:response.status,data:parsed};
}
function status(result,expected){assert.equal(result.status,expected,JSON.stringify(result.data).slice(0,200));return result.data;}
async function check(name,fn){
 try{const detail=await fn();report.checks.push({id:name,status:"PASS",detail});console.log("PASS",name,JSON.stringify(detail).slice(0,300));}
 catch(e){report.checks.push({id:name,status:"FAIL",error:String(e.stack||e).slice(0,440)});throw e;}
}
try{
 const applicant=await actor("applicant"),unverified=await actor("unverified",false),other=await actor("other"),racer=await actor("race");
 const [a,u,b,c]=await Promise.all([applicant,unverified,other,racer].map(token));
 await check("01 guests denied even without a client-supplied UID",async()=>{status(await call("GET"),401);status(await call("POST",undefined,form),401);return {guest:401}});
 await check("02 non-verified identity cannot submit",async()=>{status(await call("POST",u,form),403);return {unverified:403}});
 await check("03 new verified applicants see an empty own record",async()=>{assert.equal(status(await call("GET",a),200).application,null);return {empty:true}});
 await check("04 privilege and tenant claims in request body rejected",async()=>{
   for(const extra of [{admin:true},{superuser:true},{tenantId:"foreign"},{status:"activated"},{applicantUid:other.uid},{email:"external@example.test"}])status(await call("POST",a,{...form,...extra}),400);
   return {forgedFieldsRejected:6};
 });
 await check("05 invalid timezone and code rejected",async()=>{status(await call("POST",a,{...form,timezone:"Mars/Invalid"}),400);status(await call("POST",a,{...form,countryCode:"GT-FAKE"}),400);return {badInputs:2}});
 await check("06 content type and bounded body enforced",async()=>{status(await call("POST",a,JSON.stringify(form),{raw:true,contentType:false}),415);status(await call("POST",a,{...form,organizationName:"x".repeat(4500)}),413);return {mediaType:415,tooLarge:413}});
 let application;
 await check("07 applicant request persisted with submitted state and trusted email",async()=>{
   const r=status(await call("POST",a,form),201);application=r.application;
   assert.equal(application.applicantUid,applicant.uid);assert.equal(application.applicantEmail,applicant.email);
   assert.equal(application.status,"received");assert.equal(r.duplicate,false);
   return {status:application.status,applicationId:application.applicationId,hasServerIdentity:true};
 });
 await check("08 duplicate request does not create second record",async()=>{
   const r=status(await call("POST",a,form),200);assert.equal(r.duplicate,true);
   assert.equal(r.application.applicationId,application.applicationId);assert.equal(r.application.createdAt,application.createdAt);
   return {duplicate:true,unchangedCreation:true};
 });
 await check("09 applicant cannot overwrite an existing application by changed payload",async()=>{
   status(await call("POST",a,{...form,organizationName:"Another organization"}),409);return {conflict:409};
 });
 await check("10 another applicant cannot query the first applicant or spoof query uid",async()=>{
   assert.equal(status(await call("GET",b),200).application,null);
   assert.equal(status(await call("GET",b,undefined,{path:path+"?uid="+encodeURIComponent(applicant.uid)}),200).application,null);
   return {foreignRecordsVisible:0};
 });
 await check("11 own GET restores server record after a fresh Firebase token",async()=>{
   const newToken=await token(applicant);
   const item=status(await call("GET",newToken),200).application;
   assert.equal(item.applicationId,application.applicationId);
   assert.equal(item.applicantUid,applicant.uid);
   return {persisted:true,serverIdentity:true};
 });
 await check("12 concurrent submissions remain one application",async()=>{
   const [first,second]=await Promise.all([call("POST",c,form),call("POST",c,form)]);
   assert.deepEqual([first.status,second.status].sort(),[200,201]);
   assert.equal(first.data.application.applicationId,second.data.application.applicationId);
   return {statusCodes:[first.status,second.status],sameRecord:true};
 });
 await check("13 Firestore has records but no self-provisioned institution or role",async()=>{
   const docs=await db.collection("institutionApplications").get();assert.equal(docs.size,2);
   const row=docs.docs.find(x=>x.id===application.applicationId);
   assert.equal(row.data().status,"received");
   assert.equal(row.data().tenantId,undefined);assert.equal(row.data().admin,undefined);
   const u=await auth.getUser(applicant.uid);assert.equal(u.customClaims,undefined);
   return {applicationCount:docs.size,status:"received",tenantCreated:false,adminGranted:false};
 });
}catch(e){report.error=String(e.stack||e).slice(0,1800)}finally{
 report.summary={passed:report.checks.filter(x=>x.status==="PASS").length,failed:report.checks.filter(x=>x.status==="FAIL").length};
 report.status=report.error?"FAIL":"PASS";
 let cleanup=0;for(const actor of users){try{await auth.deleteUser(actor.uid)}catch{cleanup++}}
 report.cleanup=cleanup===0?"Deleted all synthetic users; Firestore Emulator discarded records":"Some synthetic user deletion failed";
 mkdirSync("evidence/first-client-institution-request-2026-10-14",{recursive:true});
 writeFileSync("evidence/first-client-institution-request-2026-10-14/api-results.json",JSON.stringify(report,null,2)+"\n");
 await deleteApp(app);
}
console.log("APPLICATION_QA_FINAL",JSON.stringify({status:report.status,summary:report.summary,cleanup:report.cleanup}));
if(report.error)throw Error(report.error);
