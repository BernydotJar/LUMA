import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { REQUIRED_CHECKS, REPOSITORY } from './policy.mjs';
const out = resolve(import.meta.dirname, '../../evidence/cicd-enterprise');
function api(path, body, method = 'GET') {
  const raw = execFileSync('gh', ['api', `repos/${REPOSITORY}/${path}`, '--method', method, ...(body ? ['--input', '-'] : [])], { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8' });
  return raw ? JSON.parse(raw) : null;
}
const apply = process.argv.includes('--apply');
const checks = api('commits/63c7dc471df1807af6d63941b5a95af68e045623/check-runs').check_runs;
for (const name of REQUIRED_CHECKS) {
  const matching = checks.filter(check => check.name === name && check.app.id === 15368);
  assert.equal(matching.length, 1);
  assert.equal(matching[0].conclusion, 'success');
}
const repo = JSON.parse(execFileSync('gh', ['api', `repos/${REPOSITORY}`], { encoding: 'utf8' }));
assert.equal(repo.id, 1403901485);
assert.equal(repo.permissions.admin, true, 'Administrator recovery access must be available');
const branch = api('branches/main');
const protection = {
  required_status_checks: { strict: true, checks: REQUIRED_CHECKS.map(context => ({ context, app_id: 15368 })) },
  enforce_admins: true,
  required_pull_request_reviews: { dismiss_stale_reviews: true, require_code_owner_reviews: false, required_approving_review_count: 0, require_last_push_approval: false },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  required_conversation_resolution: true,
  block_creations: false,
  lock_branch: false,
  allow_fork_syncing: false,
};
mkdirSync(out, { recursive: true });
if (!apply) {
  console.log(JSON.stringify({ apply: false, currentProtected: branch.protected, planned: protection }, null, 2));
} else {
  // A rerun verifies an existing policy; it does not silently replace it.
  if (!branch.protected) api('branches/main/protection', protection, 'PUT');
  const actual = api('branches/main/protection');
  assert.equal(actual.enforce_admins.enabled, true);
  assert.equal(actual.required_status_checks.strict, true);
  assert.equal(actual.allow_force_pushes.enabled, false);
  assert.equal(actual.allow_deletions.enabled, false);
  assert.ok(actual.required_pull_request_reviews);
  for (const name of REQUIRED_CHECKS) assert.ok(actual.required_status_checks.checks.some(item => item.context === name && item.app_id === 15368));
  api('environments/production', { deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } }, 'PUT');
  const variables = api('environments/production/variables').variables;
  // These are public resource identifiers, not credentials or secrets.
  for (const [name, value] of Object.entries({
    LUMA_WIF_PROVIDER: 'projects/161313706596/locations/global/workloadIdentityPools/github-luma/providers/production',
    LUMA_DEPLOY_SERVICE_ACCOUNT: 'luma-github-release@luma-learning-intelligence.iam.gserviceaccount.com',
  })) {
    const exists = variables.some(item => item.name === name);
    api(`environments/production/variables${exists ? '/' + name : ''}`, { name, value }, exists ? 'PATCH' : 'POST');
  }
  const environment = api('environments/production');
  assert.equal(environment.deployment_branch_policy.protected_branches, true);
  const evidence = { observedAt: new Date().toISOString(), repository: REPOSITORY, protection: actual, environment: { name: environment.name, deployment_branch_policy: environment.deployment_branch_policy }, humanApprovalCount: actual.required_pull_request_reviews.required_approving_review_count, note: 'PR and verified CI are mandatory for all actors, including administrators. No separate human approval is configured for this owner-operated repository. Administrative policy recovery remains available in repository Settings; it is not a merge bypass.' };
  writeFileSync(resolve(out, 'github-protection.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('Verified protected main, pinned required-check application, protected production environment, and public OIDC configuration variables.');
}
