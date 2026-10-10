/** Independent, read-only post-change IAM and runtime identity verification. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const project='luma-learning-intelligence';
const number='161313706596';
const release='luma-github-release@'+project+'.iam.gserviceaccount.com';
const compute='firebase-app-hosting-compute@'+project+'.iam.gserviceaccount.com';
const role='projects/'+project+'/roles/lumaAppHostingRelease';
const expectedProviderCondition=[
"assertion.repository_id == '1403901485'",
"assertion.repository_owner_id == '16258017'",
"assertion.ref == 'refs/heads/main'",
"assertion.sub == 'repo:BernydotJar@16258017/LUMA@1403901485:environment:production'",
"assertion.workflow_ref == 'BernydotJar/LUMA/.github/workflows/quality.yml@refs/heads/main'",
"assertion.event_name == 'push'"
].join(' && ');
const prefix='/usr/local/lib/node_modules/firebase-tools/lib/';
const report={checkedAt:new Date().toISOString(),project,status:'STARTED'};
try {
  await (await import(prefix+'requireAuth.js')).default.requireAuth({project,nonInteractive:true});
  const {Client}=(await import(prefix+'apiv2.js')).default;
  const iam=new Client({urlPrefix:'https://iam.googleapis.com',apiVersion:'v1',auth:true});
  const crm=new Client({urlPrefix:'https://cloudresourcemanager.googleapis.com',apiVersion:'v1',auth:true});
  const storage=new Client({urlPrefix:'https://storage.googleapis.com',apiVersion:'storage/v1',auth:true});
  const app=(await import(prefix+'gcp/apphosting.js')).default;
  const info=await app.getBackend(project,'us-central1','luma');
  assert.equal(info.serviceAccount,compute);
  const p=(await iam.get('projects/'+number+'/locations/global/workloadIdentityPools/github-luma/providers/production')).body;
  assert.equal(p.attributeCondition,expectedProviderCondition);
  assert.notEqual(p.disabled,true);
  const cp=(await iam.post('projects/'+project+'/serviceAccounts/'+compute+':getIamPolicy',{options:{requestedPolicyVersion:3}})).body;
  const narrow=cp.bindings?.filter(x=>x.role==='roles/iam.serviceAccountUser'&&!x.condition)??[];
  assert.equal(narrow.length,1);
  assert.deepEqual(narrow[0].members,['serviceAccount:'+release]);
  const projectPolicy=(await crm.post('projects/'+project+':getIamPolicy',{options:{requestedPolicyVersion:3}})).body;
  const roles=(projectPolicy.bindings??[]).filter(b=>b.members?.includes('serviceAccount:'+release)).map(b=>b.role).sort();
  assert.deepEqual(roles,[role],'Unexpected broad project grant to release identity');
  const b='firebaseapphosting-sources-'+number+'-us-central1';
  const bucketPolicy=(await storage.get('b/'+b+'/iam')).body;
  const bucketRoles=(bucketPolicy.bindings??[]).filter(x=>x.members?.includes('serviceAccount:'+release)).map(x=>x.role).sort();
  assert.deepEqual(bucketRoles,['roles/storage.objectCreator']);
  const keys=(await iam.get('projects/'+project+'/serviceAccounts/'+release+'/keys',{queryParams:{keyTypes:'USER_MANAGED'}})).body;
  assert.equal(keys.keys?.length??0,0);
  report.status='PASS';report.backendIdentityVerified=true;report.immutableWifConditionVerified=true;
  report.exactComputeIamBindingVerified=true;report.releaseProjectRoles=roles;report.sourceBucketRoles=bucketRoles;
  report.releaseUserManagedKeyCount=0;report.projectWideActAs=false;
  console.log(JSON.stringify(report,null,2));
} catch(error) {report.status='BLOCKED';report.error=error.message;console.error(error.message);process.exitCode=1;}
finally{fs.writeFileSync(path.resolve(import.meta.dirname,'independent-iam-verification.json'),JSON.stringify(report,null,2)+'\n');}
