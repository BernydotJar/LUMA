/**
 * Narrow operator-only remediation for the observed createBuild actAs denial.
 * Default: read-only inspection. --apply: one binding on the existing runtime
 * service account; no project-wide grants or modifications to the release SA.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const project = 'luma-learning-intelligence';
const number = '161313706596';
const releaseEmail = 'luma-github-release@luma-learning-intelligence.iam.gserviceaccount.com';
const computeEmail = 'firebase-app-hosting-compute@luma-learning-intelligence.iam.gserviceaccount.com';
const member = 'serviceAccount:' + releaseEmail;
const target = 'projects/' + project + '/serviceAccounts/' + computeEmail;
const role = 'roles/iam.serviceAccountUser';
const provider = 'projects/' + number + '/locations/global/workloadIdentityPools/github-luma/providers/production';
const cli = '/usr/local/lib/node_modules/firebase-tools/lib/';
const apply = process.argv.includes('--apply');
const file = path.resolve(import.meta.dirname, apply ? 'actas-remediation.json' : 'actas-inspection.json');
const state = { at: new Date().toISOString(), project, target, member, role, mode: apply ? 'APPLY' : 'INSPECT', status: 'STARTED', bindingsAdded: 0 };
try {
  await (await import(cli + 'requireAuth.js')).default.requireAuth({ project, nonInteractive: true });
  const { Client } = (await import(cli + 'apiv2.js')).default;
  const iam = new Client({ urlPrefix: 'https://iam.googleapis.com', apiVersion: 'v1', auth: true });
  const release = (await iam.get('projects/' + project + '/serviceAccounts/' + releaseEmail)).body;
  const compute = (await iam.get(target)).body;
  const identity = (await iam.get(provider)).body;
  assert.equal(release.email, releaseEmail, 'Release account identity drift');
  assert.equal(compute.email, computeEmail, 'Compute identity drift');
  assert.notEqual(release.disabled, true);
  assert.notEqual(compute.disabled, true);
  assert.notEqual(identity.disabled, true);
  const expectedProviderCondition = [
    "assertion.repository_id == '1403901485'",
    "assertion.repository_owner_id == '16258017'",
    "assertion.ref == 'refs/heads/main'",
    "assertion.sub == 'repo:BernydotJar@16258017/LUMA@1403901485:environment:production'",
    "assertion.workflow_ref == 'BernydotJar/LUMA/.github/workflows/quality.yml@refs/heads/main'",
    "assertion.event_name == 'push'",
  ].join(' && ');
  assert.equal(identity.attributeCondition, expectedProviderCondition, 'WIF provider contains unexpected trust predicates');
  assert.ok(identity.attributeCondition.includes("assertion.sub == 'repo:BernydotJar@16258017/LUMA@1403901485:environment:production'"), 'Immutable OIDC subject drift');
  assert.ok(identity.attributeCondition.includes("assertion.ref == 'refs/heads/main'"), 'Branch constraint missing');
  assert.ok(identity.attributeCondition.includes("assertion.repository_id == '1403901485'"), 'Repository identity constraint missing');
  assert.ok(identity.attributeCondition.includes("assertion.repository_owner_id == '16258017'"), 'Owner identity constraint missing');
  assert.ok(identity.attributeCondition.includes("assertion.workflow_ref == 'BernydotJar/LUMA/.github/workflows/quality.yml@refs/heads/main'"), 'Workflow constraint missing');
  assert.ok(identity.attributeCondition.includes("assertion.event_name == 'push'"), 'Push event constraint missing');
  const get = () => iam.post(target + ':getIamPolicy', { options: { requestedPolicyVersion: 3 } });
  const existing = (await get()).body;
  assert.ok(existing.etag, 'Refusing update without etag');
  const current = existing.bindings ?? [];
  const matching = current.filter(x => x.role === role && !x.condition && x.members?.includes(member));
  assert.ok(matching.length <= 1, 'Duplicate existing role binding');
  state.before = { etagPresent: Boolean(existing.etag), bindingCount: current.length, alreadyGranted: matching.length === 1 };
  if (matching.length === 0 && apply) {
    const bindings = structuredClone(current);
    const bind = bindings.find(x => x.role === role && !x.condition);
    if (bind) bind.members = [...new Set([...(bind.members ?? []), member])];
    else bindings.push({ role, members: [member] });
    await iam.post(target + ':setIamPolicy', { policy: { ...existing, version: 3, bindings } });
    state.bindingsAdded = 1;
  }
  const after = (await get()).body;
  const finalBindings = (after.bindings ?? []).filter(x => x.role === role && !x.condition && x.members?.includes(member));
  assert.equal(finalBindings.length, apply || matching.length ? 1 : 0, 'Permission read-back mismatch');
  if (apply) assert.equal((after.bindings ?? []).length, current.length + (state.bindingsAdded && !current.some(x => x.role === role && !x.condition) ? 1 : 0), 'Unexpected role binding changes');
  state.after = { etagPresent: Boolean(after.etag), bindingCount: after.bindings?.length ?? 0, scopedGrantVerified: finalBindings.length === 1 };
  state.status = apply ? 'VERIFIED_SCOPED_BINDING' : 'INSPECTED_NO_CHANGE';
  console.log(JSON.stringify(state, null, 2));
} catch (error) {
  state.status = 'BLOCKED';
  state.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
}
