import { describe, expect, it } from "vitest";
import {
  assertScopedCoachLearner,
  listScopedCoachLearnerIds,
  resolveCoachLearningScope,
  type CoachEnrollmentReader,
} from "./coach-scoped-learning";
import type { LearningCoachAccess } from "./coach-access";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";

const scope = { tenantId: "tenant-a", programId: "program-a" };
const access: LearningCoachAccess = { unrestricted: false, tenantIds: ["tenant-a"], learnerIds: [] };
const admin: LearningCoachAccess = { unrestricted: true, tenantIds: [], learnerIds: [] };
const headers = (programId?: string) => ({ get(name: string) {
  return name === "x-luma-program-id" ? programId ?? null : null;
} });
const env = {
  LUMA_LEARNING_ACCESS_MODE: "entitled",
  LUMA_LEARNING_TENANT_ID: "tenant-a",
  LUMA_LEARNING_PROGRAM_ID: "program-a",
};

function record(learnerId: string, overrides: Partial<CommerceEnrollmentRecord> = {}): CommerceEnrollmentRecord {
  return {
    enrollmentId: `enrollment-${learnerId}`, entitlementId: `entitlement-${learnerId}`,
    tenantId: "tenant-a", programId: "program-a", productId: "product",
    customerId: learnerId, learnerId, status: "active",
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
    lastProvider: "hotmart", lastProviderEventId: "evt",
    lastEventAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}
function store(map: Record<string, CommerceEnrollmentRecord[]>): CoachEnrollmentReader {
  return {
    async sampleActiveLearnerIdsByTenants() { return Object.keys(map); },
    async listByLearner(uid) { return map[uid] ?? []; },
  };
}

describe("coach program-scoped reads", () => {
  it("keeps showcase separate and rejects unauthorized strict coach tenants", () => {
    expect(resolveCoachLearningScope(access, headers(), {})).toBeUndefined();
    expect(() => resolveCoachLearningScope({
      unrestricted: false, tenantIds: ["tenant-b"], learnerIds: [],
    }, headers(), env)).toThrow("COACH_SCOPE_REQUIRED");
    expect(resolveCoachLearningScope(access, headers(), env)).toEqual(scope);
  });

  it("requires explicit program choice in multi-program deployment", () => {
    expect(() => resolveCoachLearningScope(access, headers(), {
      ...env, LUMA_LEARNING_PROGRAM_ID: undefined,
    })).toThrow("LEARNING_PROGRAM_SELECTION_REQUIRED");
    expect(resolveCoachLearningScope(access, headers("program-b"), env))
      .toEqual({ ...scope, programId: "program-b" });
  });

  it("denies an enrolled learner of another program or tenant even to an admin", async () => {
    const reader = store({
      "learner-a": [record("learner-a")],
      "learner-b": [record("learner-b", { tenantId: "tenant-b" })],
      "learner-c": [record("learner-c", { programId: "program-b" })],
      "learner-d": [record("learner-d", { status: "revoked" })],
    });
    expect(await listScopedCoachLearnerIds(admin, scope, reader, 20))
      .toEqual(["learner-a"]);
    await expect(assertScopedCoachLearner(admin, scope, "learner-b", reader))
      .rejects.toThrow("COACH_LEARNER_SCOPE_FORBIDDEN");
    await expect(assertScopedCoachLearner(admin, scope, "learner-a", reader))
      .resolves.toBeUndefined();
  });

  it("does not trust an explicit learner claim without matching scoped enrollment", async () => {
    const reader = store({ "learner-z": [record("learner-z", { tenantId: "tenant-b" })] });
    const explicit: LearningCoachAccess = {
      unrestricted: false, tenantIds: [], learnerIds: ["learner-z"],
    };
    expect(await listScopedCoachLearnerIds(explicit, scope, reader, 10)).toEqual([]);
  });
});
