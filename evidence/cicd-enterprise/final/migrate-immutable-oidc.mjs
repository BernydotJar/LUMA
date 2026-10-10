import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Narrow operational migration, not a permission expansion. It updates only the
// literal subject format after reading GitHub's actual repository OIDC settings.
// The deployed application and its reviewed source remain unchanged.
const apply = process.argv.includes('--apply');
const project = 'luma-learning-intelligence';
const provider = 'projects/161313706596/locations/global/workloadIdentityPools/github-luma/providers/production';
const repo = 'BernydotJar/LUMA';
const github = path => JSON.parse(execFileSync('gh', ['api', `repos/${repo}${path}`], { encoding: 'utf8' }));
const repository = github('');
const settings = github('/actions/oidc/customization/sub');
assert.equal(repository.id, 1403901485);
assert.equal(repository.owner.id, 16258017);
assert.equal(repository.full_name, repo);
assert.equal(settings.use_default, true);
assert.equal(settings.use_immutable_subject, true);
assert.equal(settings.sub_claim_prefix, 'repo:BernydotJar@16258017/LUMA@1403901485');
const subject = settings.sub_claim_prefix + ':environment:production';
const original = JSON.parse(readFileSync(resolve(import.meta.dirname, '../identity-configuration.json'), 'utf8'));
const oldCondition = original.attributeCondition;
const oldMatch = "assertion.sub == 'repo:BernydotJar/LUMA:environment:production'";
assert.ok(oldCondition.includes(oldMatch));
const newCondition = oldCondition.replace(oldMatch, `assertion.sub == '${subject}'`);
const cli = '/usr/local/lib/node_modules/firebase-tools/lib/';
await (await import(cli + 'requireAuth.js')).default.requireAuth({ project, nonInteractive: true });
const { Client } = (await import(cli + 'apiv2.js')).default;
const iam = new Client({ urlPrefix: 'https://iam.googleapis.com', apiVersion: 'v1', auth: true });
const before = (await iam.get(provider)).body;
assert.equal(before.oidc.issuerUri, 'https://token.actions.githubusercontent.com');
assert.deepEqual(before.attributeMapping, { 'google.subject': 'assertion.sub', 'attribute.repository_id': 'assertion.repository_id' });
assert.ok(before.attributeCondition === oldCondition || before.attributeCondition === newCondition, 'Provider has unexpected independent drift');
if (apply && before.attributeCondition !== newCondition) {
  const operation = (await iam.patch(provider, { attributeCondition: newCondition }, { queryParams: { updateMask: 'attributeCondition' } })).body;
  if (operation.name?.includes('/operations/')) {
    let done = false;
    for (let attempt = 0; attempt < 45; attempt++) {
      const state = (await iam.get(operation.name)).body;
      if (state.error) throw new Error(state.error.message);
      if (state.done) { done = true; break; }
      await delay(2000);
    }
    assert.equal(done, true, 'Provider migration did not complete');
  }
}
const after = (await iam.get(provider)).body;
if (apply) assert.equal(after.attributeCondition, newCondition);
assert.deepEqual(after.attributeMapping, before.attributeMapping);
assert.deepEqual(after.oidc, before.oidc);
const evidence = {
  status: apply ? 'CONFIGURED_REQUIRES_WORKFLOW_EXECUTION' : 'INSPECTED_NO_CHANGES',
  observedAt: new Date().toISOString(), provider,
  repository: { id: repository.id, ownerId: repository.owner.id, createdAt: repository.created_at },
  githubOidcSettings: settings, beforeCondition: before.attributeCondition, expectedCondition: newCondition,
  actualCondition: after.attributeCondition, mappingUnchanged: true, issuerUnchanged: true,
  permissionChanges: [], scopeChanges: [],
  explanation: 'Replaces the obsolete name-only subject with the exact immutable subject reported by GitHub. Repository/owner numeric IDs, main branch, production environment, exact workflow and push-event requirements remain unchanged. No token was requested, printed or persisted by this migration.',
  reference: 'https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims',
};
writeFileSync(resolve(import.meta.dirname, apply ? 'immutable-oidc-migration.json' : 'immutable-oidc-inspection.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify({ status: evidence.status, subject, permissionChanges: [] }));
