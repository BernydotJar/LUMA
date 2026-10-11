import { describe, expect, it } from "vitest";
import { parsePreparePlanInput, parseReviewPlanInput } from "./publication-plan-input";

const digest = "a".repeat(64);
const requestId = "plan-unique-request-0000000001";
const prepare = { requestId, expectedPlanRevision: 0, expectedDraftVersion: 1, expectedReadinessDigest: digest };
const review = { requestId, expectedPlanRevision: 1, action: "review", reasonCode: "reviewed-for-next-gate" };

describe("Publication planning input contracts", () => {
  it("accepts only exact prepare, review and withdrawal shapes", () => {
    expect(parsePreparePlanInput("tenant-a", prepare)).toMatchObject({ tenantId: "tenant-a", ...prepare });
    expect(parseReviewPlanInput("tenant-a", review)).toMatchObject({ tenantId: "tenant-a", ...review });
    expect(parseReviewPlanInput("tenant-a", {
      ...review, action: "withdraw", reasonCode: "security-stop",
    }).action).toBe("withdraw");
  });
  it("rejects client-supplied flags, authority, metadata or fabricated readiness", () => {
    for (const extra of ["activationAllowed", "published", "config", "preflight", "tenantId", "actorUid", "releaseApproved"]) {
      expect(() => parsePreparePlanInput("tenant-a", { ...prepare, [extra]: true }))
        .toThrow("INSTITUTION_PLAN_UNEXPECTED_FIELD");
      expect(() => parseReviewPlanInput("tenant-a", { ...review, [extra]: true }))
        .toThrow("INSTITUTION_PLAN_UNEXPECTED_FIELD");
    }
  });
  it("rejects incorrect versions, low-entropy receipts and invalid digests", () => {
    expect(() => parsePreparePlanInput("../tenant", prepare)).toThrow();
    expect(() => parsePreparePlanInput("tenant-a", { ...prepare, requestId: "short" })).toThrow();
    expect(() => parsePreparePlanInput("tenant-a", { ...prepare, expectedDraftVersion: 0 })).toThrow();
    expect(() => parsePreparePlanInput("tenant-a", { ...prepare, expectedPlanRevision: -1 })).toThrow();
    expect(() => parsePreparePlanInput("tenant-a", { ...prepare, expectedReadinessDigest: "b" })).toThrow();
    expect(() => parsePreparePlanInput("tenant-a", { ...prepare, expectedReadinessDigest: "A".repeat(64) })).toThrow();
  });
  it("requires a reason matching review/withdraw and an exact revision", () => {
    expect(() => parseReviewPlanInput("tenant-a", { ...review, action: "publish" })).toThrow();
    expect(() => parseReviewPlanInput("tenant-a", { ...review, reasonCode: "security-stop" })).toThrow();
    expect(() => parseReviewPlanInput("tenant-a", { ...review, action: "withdraw", reasonCode: "reviewed-for-next-gate" })).toThrow();
    expect(() => parseReviewPlanInput("tenant-a", { ...review, expectedPlanRevision: 0 })).toThrow();
    expect(() => parseReviewPlanInput("tenant-a", { ...review, expectedPlanRevision: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  });
});
