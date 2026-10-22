import { describe, expect, it } from "vitest";
import {
  parseAssessmentScope, parsePrepareAssessment, parseTransitionAssessment,
  sourcesForPublishedClasses,
} from "./assessment-publication-input";

const scope = { tenantId: "academy_alpha", programId: "pnl-practitioner" };
const validPrepare = {
  requestId: "qa-assessment-123456789",
  expectedPlanRevision: 0,
  offeringId: "offering-a",
  version: "practitioner-entry-v1",
  curriculumRevision: "pnl-curriculum-v1",
  classSlugs: ["calibracion-observar-antes-de-interpretar", "congruencia-tres-canales"],
  recommendedNextSlug: "calibracion-observar-antes-de-interpretar",
  reasonCode: "new-curriculum",
};
const validReview = {
  requestId: "qa-review-123456789",
  expectedPlanRevision: 1, action: "review",
  reasonCode: "reviewed-with-rights-evidence",
  rightsRecordId: "course-licence-file-a",
  rightsEvidenceSha256: "a".repeat(64),
};
describe("Assessment institutional publisher input contracts", () => {
  it("refuses program/tenant traversal and invalid paths", () => {
    expect(() => parseAssessmentScope("../admin", "pnl")).toThrow();
    expect(() => parseAssessmentScope("alpha", "pnl/advanced")).toThrow();
    expect(parseAssessmentScope("alpha", "pnl")).toEqual({ tenantId: "alpha", programId: "pnl" });
  });
  it("parses strictly bounded real class contracts and derives sources on the server", () => {
    const input = parsePrepareAssessment(scope, validPrepare);
    expect(input.classSlugs).toEqual(validPrepare.classSlugs);
    expect(sourcesForPublishedClasses(input.classSlugs).length).toBeGreaterThan(0);
    expect(Object.keys(input)).not.toContain("sourceIds");
  });
  it("rejects client-supplied roles, source IDs, rights approval, or activation", () => {
    expect(() => parsePrepareAssessment(scope, { ...validPrepare, sourceIds: ["foreign"] })).toThrow();
    expect(() => parsePrepareAssessment(scope, { ...validPrepare, published: true })).toThrow();
    expect(() => parsePrepareAssessment(scope, { ...validPrepare, approvedByUid: "self" })).toThrow();
    expect(() => parsePrepareAssessment(scope, { ...validPrepare, rightsStatus: "approved" })).toThrow();
  });
  it.each([
    { classSlugs: ["../admin"] },
    { classSlugs: ["fake-experience"] },
    { classSlugs: ["congruencia-tres-canales", "congruencia-tres-canales"] },
    { classSlugs: [] },
    { recommendedNextSlug: "rapport-sintonia-con-respeto" },
    { version: "../../secret" },
    { offeringId: "../secret" },
    { expectedPlanRevision: -1 },
  ])("refuses malformed academic or state field %j", (change) => {
    expect(() => parsePrepareAssessment(scope, { ...validPrepare, ...change })).toThrow();
  });
  it("requires a bounded external rights evidence reference for a distinct reviewer", () => {
    expect(parseTransitionAssessment(scope, validReview)).toMatchObject({
      rightsRecordId: validReview.rightsRecordId,
      rightsEvidenceSha256: validReview.rightsEvidenceSha256,
      action: "review",
    });
    expect(() => parseTransitionAssessment(scope, {
      ...validReview, rightsEvidenceSha256: "not-a-digest",
    })).toThrow();
    expect(() => parseTransitionAssessment(scope, { ...validReview, submittedByUid: "spoof" })).toThrow();
  });
  it("limits publish and withdraw to explicit, non-activating commands", () => {
    const publish = {
      requestId: "qa-publish-123456789",
      expectedPlanRevision: 2, action: "publish", reasonCode: "publish-reviewed-curriculum",
    };
    expect(parseTransitionAssessment(scope, publish).action).toBe("publish");
    expect(() => parseTransitionAssessment(scope, { ...publish, version: "attacker" })).toThrow();
    expect(() => parseTransitionAssessment(scope, { ...publish, reasonCode: "force-publish" })).toThrow();
    expect(parseTransitionAssessment(scope, {
      ...publish, action: "withdraw", reasonCode: "rights-revoked",
    }).action).toBe("withdraw");
  });
});
