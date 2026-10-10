import { describe, expect, it } from "vitest";
import { coachAccessHasScope, learningCoachAccessFromClaims } from "./coach-access";

describe("learning coach access", () => {
  it("grants unrestricted access only to platform superusers", () => {
    expect(learningCoachAccessFromClaims({ admin: true }).unrestricted).toBe(false);
    expect(learningCoachAccessFromClaims({ admin: true }).institutionalAdmin).toBe(true);
    expect(coachAccessHasScope(learningCoachAccessFromClaims({ admin: true }))).toBe(false);
    expect(learningCoachAccessFromClaims({ role: "superuser" }).unrestricted).toBe(true);
    expect(learningCoachAccessFromClaims({ superuser: true }).unrestricted).toBe(true);
    expect(learningCoachAccessFromClaims({ coach: true }).unrestricted).toBe(false);
  });

  it("keeps tenant administrator access scoped and cannot inherit arbitrary learner/coach claims", () => {
    const access = learningCoachAccessFromClaims({
      role: "admin", adminTenantIds: ["tenant-a", "tenant-a"],
      tenantIds: ["tenant-b"],
      coachTenantIds: ["foreign-tenant"],
      learnerIds: ["foreign-learner"], coachLearnerIds: ["other-learner"],
    });
    expect(access).toEqual({
      unrestricted: false, institutionalAdmin: true,
      tenantIds: ["tenant-a"], learnerIds: [],
    });
    expect(coachAccessHasScope(access)).toBe(true);
  });

  it("normalizes tenant and learner assignment claims for coaches", () => {
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

  it("fails closed when a coach lacks assignments or an admin lacks authorized tenants", () => {
    expect(coachAccessHasScope(learningCoachAccessFromClaims({ role: "coach" }))).toBe(false);
    expect(coachAccessHasScope(learningCoachAccessFromClaims({ role: "admin" }))).toBe(false);
  });
});
