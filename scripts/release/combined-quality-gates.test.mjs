import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

const path = resolve(import.meta.dirname, '../../.github/workflows/quality.yml');
const workflow = yaml.load(readFileSync(path, 'utf8'));
const jobs = workflow.jobs;
const releaseSafety = ['release-readiness', 'learning-auth-uat',
  'product-acceptance-contract', 'product-acceptance-predeploy'];

// Regression guard for #71 + #83 integration. Successful emulated learner UAT
// cannot replace source signature or independently protected product acceptance.
test('every independent release gate survives the enterprise/learning merge', () => {
  for (const name of releaseSafety) {
    assert.ok(jobs[name], `Required quality job missing: ${name}`);
    assert.ok(jobs.deploy.needs.includes(name), `Deploy lost release blocker: ${name}`);
  }
  assert.ok(jobs['release-readiness'].needs.includes('learning-auth-uat'));
  assert.ok(jobs['product-acceptance-predeploy'].needs.includes('product-acceptance-contract'));
});

test('learning QA is authenticated, source-bound and never product release approval', () => {
  const steps = jobs['learning-auth-uat'].steps.map(step => String(step.run ?? ''));
  assert.ok(steps.some(step => step.includes('firebase-tools') && step.includes('auth,firestore')));
  assert.ok(steps.some(step => step.includes('report.sourceSha, process.env.GITHUB_SHA')));
  assert.ok(steps.some(step => step.includes('report.signedIndependentReviewer, false')));
  assert.ok(steps.some(step => step.includes('report.passed, 16')));
});

test('enterprise predeploy requires a protected environment and explicit signed evidence', () => {
  const gate = jobs['product-acceptance-predeploy'];
  assert.equal(gate.environment.name, 'enterprise-product-acceptance');
  assert.match(gate.if, /refs\/heads\/main/);
  const steps = gate.steps.map(step => String(step.run ?? ''));
  assert.ok(steps.some(step => step.includes('protected-acceptance-inputs.mjs')));
  assert.ok(steps.some(step => step.includes('--phase predeploy')));
  assert.ok(jobs.deploy.environment?.name === 'production');
});
