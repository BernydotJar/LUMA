import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
  "src/app/api/platform/institutions/[tenantId]/programs/[programId]/assessment-publication/route.ts", "utf8",
);
const store = readFileSync("src/lib/assessment-publication-store.ts", "utf8");
const input = readFileSync("src/lib/assessment-publication-input.ts", "utf8");
const workflow = readFileSync(".github/workflows/quality.yml", "utf8");

test("publisher remains explicitly feature-flagged off by default", () => {
  assert.match(route, /LUMA_ASSESSMENT_PUBLICATION_ENABLED === "true"/);
  assert.match(route, /if \(!featureEnabled\(\)\) return reply\(\{ error: "feature_unavailable" \}, 503\)/);
  assert.match(route, /requireLearningUser\(request, \{ checkRevoked: true \}\)/);
  assert.match(route, /assertInstitutionDraftAdmin/);
  assert.match(route, /assessmentReviewer !== true/);
  assert.match(route, /assessmentPublisher !== true/);
});
test("neither self-approval nor overwritten versions can become a publication", () => {
  assert.match(store, /ASSESSMENT_PUBLICATION_SELF_REVIEW_FORBIDDEN/);
  assert.match(store, /ASSESSMENT_PUBLICATION_SELF_PUBLICATION_FORBIDDEN/);
  assert.match(store, /ASSESSMENT_PUBLICATION_VERSION_REUSED/);
  assert.match(store, /tx\.create\(newVersionRef, publishedRevision\)/);
  assert.match(store, /tx\.create\(auditRef, audit\)/);
  assert.match(store, /validatePublishedProgramAssessment/);
  assert.match(input, /ASSESSMENT_PUBLICATION_UNEXPECTED_FIELD/);
});
test("publication authorization never bypasses protected CI acceptance or source signatures", () => {
  assert.match(workflow, /assessment-publication:/);
  assert.match(workflow, /release-readiness:/);
  assert.match(workflow, /product-acceptance-predeploy:/);
  assert.match(workflow, /name: production/);
  assert.match(workflow, /LUMA_RELEASE_ATTESTATION_PUBLIC_KEY_B64/);
  assert.match(workflow, /--only auth,firestore/);
  assert.match(workflow, /"npm run test:run --/);
});
