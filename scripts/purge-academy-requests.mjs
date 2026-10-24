#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { requireVerifiedPlatformOperator } from './lib/verified-platform-operator.mjs';
const opts={};
for(let i=2;i<process.argv.length;i++){
 const key=process.argv[i];
 if(key==='--apply'){if(opts.apply)throw Error('DUPLICATE_APPLY');opts.apply=true;continue;}
 if(!['--project','--operator-uid','--confirm-project','--as-of'].includes(key)||opts[key])throw Error('INVALID_FLAG');
 const v=process.argv[++i];if(!v||v.startsWith('--'))throw Error('INVALID_FLAG');opts[key]=v;
}
const project=opts['--project'];
if(!/^[a-z][a-z0-9-]{5,62}$/.test(project||'')||
 !/^[A-Za-z0-9_-]{1,128}$/.test(opts['--operator-uid']||'')||
 (opts.apply&&(opts['--confirm-project']!==project||process.env.LUMA_INSTITUTION_PURGE_ENABLED!=='true')))throw Error('PURGE_EXPLICIT_AUTHORIZATION_REQUIRED');
const now=opts['--as-of']||new Date().toISOString();
if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(now)||
 !Number.isFinite(Date.parse(now))||Date.parse(now)>Date.now()+60000)throw Error('PURGE_AS_OF_INVALID');
const app=initializeApp({projectId:project},'academy-retention-'+randomUUID());
async function main(){
 const auth=getAuth(app),db=getFirestore(app);
 const actor=await requireVerifiedPlatformOperator(auth,opts['--operator-uid']);
 const snap=await db.collection('institutionApplications').where('retentionExpiresAt','<=',now).limit(101).get();
 if(snap.size>100)throw Error('PURGE_OVER_CAPACITY_REQUIRES_PAGINATION');
 const eligible=[],held=[];
 for(const doc of snap.docs){
  const r=doc.data();
  if(['received','in_review','rejected','invitation_pending'].includes(r.status))eligible.push({id:doc.id,status:r.status});
  else held.push({id:doc.id,status:r.status});
 }
 const summary={mode:opts.apply?'apply':'dry-run',project,asOf:now,eligibleCount:eligible.length,heldCount:held.length,
  states:eligible.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),processed:0,
  policy:'No accepted invitations or activated admins are deleted without separate manual governance/revocation.'};
 if(!opts.apply){console.log(JSON.stringify(summary,null,2));return;}
 for(const candidate of eligible){
  const applicationRef=db.collection('institutionApplications').doc(candidate.id),
    invitationRef=db.collection('institutionOnboardingInvitations').doc(candidate.id),
    auditRef=db.collection('institutionApplicationAudits').doc(randomUUID());
  await db.runTransaction(async tx=>{
   const [application,invitation]=await Promise.all([tx.get(applicationRef),tx.get(invitationRef)]);
   const v=application.data();
   if(!application.exists||v.applicationId!==candidate.id||v.status!==candidate.status||
      v.retentionExpiresAt>now||!['received','in_review','rejected','invitation_pending'].includes(v.status))
      throw Error('PURGE_CONCURRENT_STATUS_CHANGED');
   if(v.status==='invitation_pending'&&
      (!invitation.exists||invitation.data()?.status!=='pending'||invitation.data()?.expiresAt>now))
      throw Error('PURGE_INVITATION_STILL_VALID');
   const reservationRef=v.tenantId?db.collection('institutionOnboardingTenants').doc(v.tenantId):null;
   const reservation=reservationRef?await tx.get(reservationRef):null;
   if(reservation?.exists&&reservation.data()?.applicationId!==candidate.id)throw Error('PURGE_RESERVATION_MISMATCH');
   if(reservation?.data()?.status==='activated')throw Error('PURGE_ACTIVATED_TENANT_FORBIDDEN');
   tx.create(auditRef,{action:'privacy-retention-purge',applicationId:candidate.id,actorUid:actor.uid,
     previousStatus:v.status,occurredAt:new Date().toISOString(),policyVersion:1});
   tx.delete(applicationRef);
   if(invitation.exists)tx.delete(invitationRef);
   if(reservationRef&&reservation?.exists)tx.delete(reservationRef);
  });
  summary.processed++;
 }
 console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e instanceof Error?e.message:'PURGE_FAILED');process.exitCode=1;}).finally(async()=>deleteApp(app));
