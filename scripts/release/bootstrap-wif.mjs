/* Operator-only bootstrap. Reuses Firebase CLI login; never exports credentials.
 * No keys, backend, database, billing account or capacity are created/changed.
 * Run without --apply to inspect. --apply provisions only named release identity.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const cli = '/usr/local/lib/node_modules/firebase-tools/lib/';
const project = 'luma-learning-intelligence';
const number = '161313706596';
const poolId = 'github-luma';
const providerId = 'production';
const accountId = 'luma-github-release';
const email = `${accountId}@${project}.iam.gserviceaccount.com`;
const roleId = 'lumaAppHostingRelease';
const roleName = `projects/${project}/roles/${roleId}`;
const bucket = `firebaseapphosting-sources-${number}-us-central1`;
const pool = `projects/${number}/locations/global/workloadIdentityPools/${poolId}`;
const provider = `${pool}/providers/${providerId}`;
const principal = `principalSet://iam.googleapis.com/${pool}/attribute.repository_id/1403901485`;
const condition = [
  "assertion.repository_id == '1403901485'",
  "assertion.repository_owner_id == '16258017'",
  "assertion.ref == 'refs/heads/main'",
  "assertion.sub == 'repo:BernydotJar/LUMA:environment:production'",
  "assertion.workflow_ref == 'BernydotJar/LUMA/.github/workflows/quality.yml@refs/heads/main'",
  "assertion.event_name == 'push'",
].join(' && ');
const permissions = [
  'firebaseapphosting.backends.get',
  'firebaseapphosting.builds.create', 'firebaseapphosting.builds.get',
  'firebaseapphosting.rollouts.create', 'firebaseapphosting.rollouts.get',
  'firebaseapphosting.traffic.get', 'firebaseapphosting.operations.get',
  'resourcemanager.projects.get', 'serviceusage.services.use',
].sort();
const out = path.resolve(import.meta.dirname, '../../evidence/cicd-enterprise');
const apply = process.argv.includes('--apply');
const snapshot = { project, provider, email, roleName, permissions, attributeCondition: condition, sourceBucket: bucket, mode: apply ? 'APPLY' : 'INSPECT', operations: [] };
function record(operation) {
  snapshot.operations.push({ operation, at: new Date().toISOString() });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, apply ? 'identity-configuration.json' : 'identity-inspection.json'), JSON.stringify(snapshot, null, 2) + '\n');
  console.log(operation);
}
(async () => {
  const authModule = (await import(cli + 'requireAuth.js')).default;
  await authModule.requireAuth({ project, nonInteractive: true });
  const { Client } = (await import(cli + 'apiv2.js')).default;
  const client = (urlPrefix, apiVersion) => new Client({ urlPrefix, apiVersion, auth: true });
  const iam = client('https://iam.googleapis.com', 'v1');
  const crm = client('https://cloudresourcemanager.googleapis.com', 'v1');
  const storage = client('https://storage.googleapis.com', 'storage/v1');
  const usage = client('https://serviceusage.googleapis.com', 'v1');
  async function optional(c, resource) {
    try { return (await c.get(resource)).body; }
    catch (error) { if (error.status === 404 || error.context?.response?.statusCode === 404 || /\b404\b|NOT_FOUND/.test(error.message)) return null; throw error; }
  }
  async function wait(c, operation) {
    if (!operation?.name?.includes('/operations/')) return;
    for (let i = 0; i < 60; i++) {
      const value = (await c.get(operation.name)).body;
      if (value.error) throw new Error(`Operation failed: ${value.error.message}`);
      if (value.done) return;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error('Identity operation exceeded deadline');
  }
  function addBinding(policy, role, member) {
    policy.bindings ??= [];
    let binding = policy.bindings.find(item => item.role === role && !item.condition);
    if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
    if (binding.members.includes(member)) return false;
    binding.members.push(member);
    return true;
  }
  const projectInfo = (await crm.get(`projects/${project}`)).body;
  assert.equal(String(projectInfo.projectNumber), number);
  assert.equal(projectInfo.lifecycleState, 'ACTIVE');
  const bucketInfo = (await storage.get(`b/${bucket}`)).body;
  assert.equal(String(bucketInfo.projectNumber), number);
  record('Verified existing project and source bucket');
  if (!apply) { record('INSPECT_ONLY_NO_CHANGES'); return; }
  for (const service of ['iam.googleapis.com', 'iamcredentials.googleapis.com', 'sts.googleapis.com']) {
    const resource = `projects/${number}/services/${service}`;
    const state = (await usage.get(resource)).body;
    if (state.state !== 'ENABLED') {
      await wait(usage, (await usage.post(`${resource}:enable`, {})).body);
      record(`Enabled identity API ${service}`);
    }
  }
  let role = await optional(iam, roleName);
  if (!role) {
    role = (await iam.post(`projects/${project}/roles`, { roleId, role: { title: 'LUMA gated App Hosting release', description: 'Create and inspect builds and rollouts; no delete, backend update, secret access or IAM administration.', stage: 'GA', includedPermissions: permissions } })).body;
    record('Created minimal App Hosting release role');
  }
  assert.deepEqual([...role.includedPermissions].sort(), permissions, 'Existing role permission drift');
  const account = `projects/${project}/serviceAccounts/${email}`;
  if (!await optional(iam, account)) {
    await iam.post(`projects/${project}/serviceAccounts`, { accountId, serviceAccount: { displayName: 'LUMA GitHub production release (keyless)' } });
    record('Created dedicated keyless release service account');
  }
  if (!await optional(iam, pool)) {
    await wait(iam, (await iam.post(`projects/${number}/locations/global/workloadIdentityPools`, { displayName: 'LUMA GitHub release' }, { queryParams: { workloadIdentityPoolId: poolId } })).body);
    record('Created dedicated WIF pool');
  }
  let existingProvider = await optional(iam, provider);
  const mapping = { 'google.subject': 'assertion.sub', 'attribute.repository_id': 'assertion.repository_id' };
  if (!existingProvider) {
    await wait(iam, (await iam.post(`${pool}/providers`, { displayName: 'LUMA protected main production', attributeMapping: mapping, attributeCondition: condition, oidc: { issuerUri: 'https://token.actions.githubusercontent.com' } }, { queryParams: { workloadIdentityPoolProviderId: providerId } })).body);
    existingProvider = (await iam.get(provider)).body;
    record('Created repository/owner/main/environment/workflow/event-restricted WIF provider');
  }
  assert.equal(existingProvider.attributeCondition, condition, 'WIF condition drift');
  assert.deepEqual(existingProvider.attributeMapping, mapping, 'WIF mapping drift');
  assert.equal(existingProvider.oidc.issuerUri, 'https://token.actions.githubusercontent.com');
  assert.notEqual(existingProvider.disabled, true);
  const saPolicy = (await iam.post(`${account}:getIamPolicy`, {})).body;
  if (addBinding(saPolicy, 'roles/iam.workloadIdentityUser', principal)) {
    await iam.post(`${account}:setIamPolicy`, { policy: saPolicy });
    record('Bound only the approved repository principal to release identity');
  }
  const projectPolicy = (await crm.post(`projects/${project}:getIamPolicy`, { options: { requestedPolicyVersion: 3 } })).body;
  assert.ok(projectPolicy.etag, 'Refusing project IAM write without concurrency etag');
  if (addBinding(projectPolicy, roleName, `serviceAccount:${email}`)) {
    await crm.post(`projects/${project}:setIamPolicy`, { policy: projectPolicy });
    record('Granted custom release role; existing IAM bindings preserved');
  }
  const bucketPolicy = (await storage.get(`b/${bucket}/iam`, { queryParams: { optionsRequestedPolicyVersion: 3 } })).body;
  assert.ok(bucketPolicy.etag, 'Refusing bucket IAM write without concurrency etag');
  if (addBinding(bucketPolicy, 'roles/storage.objectCreator', `serviceAccount:${email}`)) {
    await storage.put(`b/${bucket}/iam`, bucketPolicy);
    record('Granted create-only source uploads on the existing source bucket');
  }
  const keys = (await iam.get(`${account}/keys`, { queryParams: { keyTypes: 'USER_MANAGED' } })).body;
  assert.equal((keys.keys ?? []).length, 0, 'Release account has long-lived keys');
  snapshot.status = 'CONFIGURED_NOT_YET_OIDC_EXECUTION_VERIFIED';
  record('Configuration read back; no user-managed keys; no runtime or traffic mutation');
})().catch(error => {
  snapshot.status = 'BLOCKED';
  snapshot.error = error.message;
  record('Bootstrap stopped; completed operations remain recorded');
  console.error(error.message); process.exitCode = 1;
});
