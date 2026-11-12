import test from 'node:test';
import assert from 'node:assert/strict';
import { assertScopedProductPredeploy } from './product-acceptance-predeploy.mjs';
const sha = 'a'.repeat(40);
const v3 = () => ({ status: 'PASS',schemaVersion: 3,testedCommit:sha,
  review: {method:'protected-granite-owner-v1', commitSha:sha},
  ownerAuthorization:{scope:'public-landing',humanIndependent:false,commitSha:sha} });
const env = () => ({GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'BernydotJar/LUMA',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'b'.repeat(40)});
test('scope requires real protected push-to-main and reviewed-model owner signoff', () => {
  assert.equal(assertScopedProductPredeploy(v3(),env()).status,'SCOPED_PRODUCT_PREDEPLOY_PASS');
});
test('fail closed outside public landing or in a PR or non-repo context', () => {
  for (const invalid of [
    {...v3(),schemaVersion:2},{...v3(),status:'BLOCKED'},
    {...v3(),ownerAuthorization:{...v3().ownerAuthorization,scope:'owner-risk-exception'}},
    {...v3(),ownerAuthorization:{...v3().ownerAuthorization,humanIndependent:true}},
    {...v3(),review:{...v3().review,commitSha:'c'.repeat(40)}},
    {...v3(),ownerAuthorization:{...v3().ownerAuthorization,commitSha:'d'.repeat(40)}},
  ]) assert.throws(()=>assertScopedProductPredeploy(invalid,env()));
  for (const invalid of [
    {...env(),GITHUB_ACTIONS:'false'}, {...env(),GITHUB_REPOSITORY:'other/other'},
    {...env(),GITHUB_EVENT_NAME:'pull_request'}, {...env(),GITHUB_REF:'refs/heads/feat/x'},
    {...env(),GITHUB_SHA:'not-a-sha'},
  ]) assert.throws(()=>assertScopedProductPredeploy(v3(),invalid));
});
