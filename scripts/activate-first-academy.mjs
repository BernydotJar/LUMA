#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { computeTenantAdminPlanHash, planTenantAdminClaims } from "./lib/tenant-admin-claims.mjs";
import { requireVerifiedPlatformOperator } from "./lib/verified-platform-operator.mjs";

const id=/^[a-f0-9]{64}$/;
const uid=/^[A-Za-z0-9_-]{1,128}$/;
const projectName=/^[a-z][a-z0-9-]{5,62}$/;
const opts={};
for(let i=2;i<process.argv.length;i++){
 const flag=process.argv[i];
 if(flag==="--apply") {if(opts.apply)throw Error("DUPLICATE_FLAG");opts.apply=true;continue;}
 const permitted=["--project","--application-id","--operator-uid","--reason","--confirm-project","--confirm-email","--plan-sha"];
 if(!permitted.includes(flag))throw Error("UNKNOWN_FLAG");
 if(opts[flag]!==undefined)throw Error("DUPLICATE_FLAG");
 const v=process.argv[++i];if(!v||v.startsWith("--")||v.length>600)throw Error("INVALID_ARGUMENT");
 opts[flag]=v;
}
if(!projectName.test(opts["--project"]||"")||!id.test(opts["--application-id"]||"")||
   !uid.test(opts["--operator-uid"]||"")||
   typeof opts["--reason"]!=="string"||opts["--reason"].trim().length<25||
   opts["--reason"].length>500)throw Error("INVALID_ACTIVATION_ARGUMENTS");
if(opts.apply&&(opts["--confirm-project"]!==opts["--project"]||
 !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(opts["--confirm-email"]||"")||
 !id.test(opts["--plan-sha"]||"")))throw Error("ACTIVATION_CONFIRMATION_REQUIRED");

const project=opts["--project"],applicationId=opts["--application-id"],operatorUid=opts["--operator-uid"];
const app=initializeApp({projectId:project},"first-academy-activation-"+randomUUID());
const hash=v=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function main(){
 const db=getFirestore(app),auth=getAuth(app);
 const applicationRef=db.collection("institutionApplications").doc(applicationId);
 const invitationRef=db.collection("institutionOnboardingInvitations").doc(applicationId);
 const intentRef=db.collection("institutionActivationIntents").doc(applicationId);
 const [operator,applicationSnap,inviteSnap,intentSnap]=await Promise.all([
   requireVerifiedPlatformOperator(auth,operatorUid),
   applicationRef.get(),invitationRef.get(),intentRef.get(),
 ]);
 if(!applicationSnap.exists||!inviteSnap.exists)throw Error("ACTIVATION_REQUEST_NOT_FOUND");
 if(intentSnap.exists)throw Error("ACTIVATION_INTENT_EXISTS_OPERATOR_RECONCILIATION_REQUIRED");
 // The signed operator UID and email have been independently checked against Auth.
 if (!operator.email) throw Error("PLATFORM_OPERATOR_NOT_AUTHORIZED");
 const application=applicationSnap.data(),invitation=inviteSnap.data();
 if(application.applicationId!==applicationId||application.status!=="invitation_accepted"||
   !uid.test(application.applicantUid)||!uid.test(application.firstReviewerUid||"")||
   !uid.test(application.secondReviewerUid||"")||
   application.firstReviewerUid===application.secondReviewerUid||
   operatorUid===application.applicantUid||
   invitation.applicationId!==applicationId||invitation.status!=="accepted"||
   invitation.applicantUid!==application.applicantUid||
   invitation.tenantId!==application.tenantId||
   application.tenantId===undefined||
   !/^[A-Za-z0-9_-]{1,128}$/.test(application.tenantId))throw Error("ACTIVATION_APPROVAL_INCOMPLETE");
 const reservedRef=db.collection("institutionOnboardingTenants").doc(application.tenantId);
 const reservation=await reservedRef.get();
 if(!reservation.exists||reservation.data()?.applicationId!==applicationId)throw Error("ACTIVATION_TENANT_NOT_RESERVED");
 const recipient=await auth.getUser(application.applicantUid);
 const email=recipient.email?.toLowerCase().trim();
 if(!email||recipient.disabled||recipient.emailVerified!==true||
   email!==application.applicantEmail||email!==invitation.applicantEmail)throw Error("ACTIVATION_VERIFIED_ACTOR_MISMATCH");
 const planned=planTenantAdminClaims(recipient.customClaims??{},"grant",[application.tenantId]);
 if(!planned.changed)throw Error("ACTIVATION_CLAIMS_ALREADY_ASSIGNED_REVIEW_REQUIRED");
 const planHash=computeTenantAdminPlanHash({project,applicationId,
   operatorUid,recipientUid:recipient.uid,recipientEmail:email,
   tenantId:application.tenantId,firstReviewerUid:application.firstReviewerUid,
   secondReviewerUid:application.secondReviewerUid,
   previous:recipient.customClaims??{},next:planned.next});
 const response={mode:opts.apply?"apply":"dry-run",project,applicationId,
   recipientUid:recipient.uid,recipientEmail:email,tenantId:application.tenantId,
   operatorUid,planHash,previousTenants:planned.beforeTenants,nextTenants:planned.afterTenants};
 if(!opts.apply){console.log(JSON.stringify({...response,note:"READ_ONLY: independent operator must confirm project, email and exact plan SHA before applying."},null,2));return;}
 if(opts["--confirm-email"].toLowerCase().trim()!==email||opts["--plan-sha"]!==planHash)throw Error("ACTIVATION_PLAN_CONFIRMATION_MISMATCH");
 const now=new Date().toISOString();
 await db.runTransaction(async tx=>{
   const [a,i,res,intent]=await Promise.all([tx.get(applicationRef),tx.get(invitationRef),tx.get(reservedRef),tx.get(intentRef)]);
   if(intent.exists||a.data()?.status!=="invitation_accepted"||
      a.data()?.applicantUid!==recipient.uid||i.data()?.status!=="accepted"||
      res.data()?.applicationId!==applicationId)throw Error("ACTIVATION_CONCURRENT_STATE_CHANGED");
   tx.create(intentRef,{project,applicationId,operatorUid,recipientUid:recipient.uid,tenantId:application.tenantId,
     state:"intent",planHash,reason:opts["--reason"],previousClaimsDigest:hash(recipient.customClaims??{}),
     nextClaimsDigest:hash(planned.next),createdAt:now});
 });
 // Firebase Auth has no CAS for custom claims. A durable intent makes partial
 // failures operator-reconcilable, and retrying an intent is intentionally refused.
 try{const latest=await auth.getUser(recipient.uid);
   if(hash(latest.customClaims??{})!==hash(recipient.customClaims??{})||latest.disabled||latest.emailVerified!==true||
      latest.email?.trim().toLowerCase()!==email)throw Error("ACTIVATION_ACTOR_CHANGED");
   await auth.setCustomUserClaims(recipient.uid,planned.next);
 }catch(error){await intentRef.update({state:"auth_failed",updatedAt:new Date().toISOString()}).catch(()=>{});throw error;}
 try{await auth.revokeRefreshTokens(recipient.uid);}
 catch{await intentRef.update({state:"claims_applied_revocation_failed",updatedAt:new Date().toISOString()}).catch(()=>{});throw Error("ACTIVATION_CLAIMS_APPLIED_REVOCATION_FAILED_RECONCILE_MANUALLY");}
 const done=new Date().toISOString();
 try{await db.runTransaction(async tx=>{
   const [a,intent,res]=await Promise.all([tx.get(applicationRef),tx.get(intentRef),tx.get(reservedRef)]);
   if(a.data()?.status!=="invitation_accepted"||intent.data()?.planHash!==planHash||
      intent.data()?.state!=="intent"||res.data()?.applicationId!==applicationId)throw Error("ACTIVATION_STATE_CHANGED_AFTER_CLAIMS");
   tx.update(applicationRef,{status:"activated",activatedAt:done,updatedAt:done,
     activationAuditId:applicationId,retentionExpiresAt:new Date(Date.parse(done)+365*86400_000).toISOString()});
   tx.update(intentRef,{state:"applied",appliedAt:done});
   tx.update(reservedRef,{status:"activated",activatedAt:done});
   tx.create(db.collection("institutionApplicationAudits").doc(randomUUID()),{
     applicationId,actorUid:operatorUid,action:"activate",tenantId:application.tenantId,
     previousStatus:"invitation_accepted",nextStatus:"activated",occurredAt:done,
     activationAuditId:applicationId});
 });}catch{await intentRef.update({state:"claims_applied_audit_finalize_failed",updatedAt:new Date().toISOString()}).catch(()=>{});throw Error("ACTIVATION_CLAIMS_APPLIED_AUDIT_FINALIZE_FAILED_RECONCILE_MANUALLY");}
 console.log(JSON.stringify({...response,state:"activated",auditId:applicationId,
   note:"Role granted to the verified existing user; previous refresh tokens revoked. Owner must sign in again. Tenant draft and curriculum publication remain separate gates."},null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"ACTIVATION_FAILED");process.exitCode=1;}).finally(async()=>{await deleteApp(app);});
