import { describe, expect, it } from "vitest";
import { coachAccessHasScope, learningCoachAccessFromClaims } from "./coach-access";

describe("learning coach access", () => {
  it("grants unrestricted access only to admin or superuser claims", () => {
    expect(learningCoachAccessFromClaims({ admin: true }).unrestricted).toBe(true);
    expect(learningCoachAccessFromClaims({ role: "superuser" }).unrestricted).toBe(true);
    expect(learningCoachAccessFromClaims({ coach: true }).unrestricted).toBe(false);
  });

  it("normalizes tenant and learner assignment claims", () => {
    const access = learningCoachAccessFromClaims({
      role: "coach",
      tenantId: " tenant-a ",
      tenantIds: ["tenant-b", "tenant-a"],
      coachTenantIds: ["tenant-c"],
      learnerIds: ["learner-2"],
      coachLearnerIds: ["learner-1", "learner-2"],
    });
    expect(access).toEqual({
      unrestricted: false,
      tenantIds: ["tenant-a", "tenant-b", "tenant-c"],
      learnerIds: ["learner-1", "learner-2"],
    });
    expect(coachAccessHasScope(access)).toBe(true);
  });

  it("fails closed when a non-admin coach has no assignment scope", () => {
    expect(coachAccessHasScope(learningCoachAccessFromClaims({ role: "coach" }))).toBe(false);
  });
});
