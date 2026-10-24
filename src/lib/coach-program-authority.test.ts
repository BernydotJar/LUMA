import { describe, expect, it } from "vitest";
import { authorizedCoachPrograms, requireCoachProgramGrant } from "./coach-program-authority";
import { assertScopedCoachLearner, listScopedCoachLearnerIds } from "./coach-scoped-learning";
import type { LearningCoachAccess } from "./coach-access";
import type { ProgramOffering } from "./program-delivery";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";

const tenantId = "academy-qa";
const programId = "premium";
const coachUid = "coach-mary";
const scope = { tenantId, programId };
const coach: LearningCoachAccess = { unrestricted: false, tenantIds: [tenantId], learnerIds: [] };
const owner: LearningCoachAccess = { unrestricted: false, institutionalAdmin: true, tenantIds: [tenantId], learnerIds: [] };
const superuser: LearningCoachAccess = { unrestricted: true, tenantIds: [], learnerIds: [] };
function offering(id: string, overrides: Partial<ProgramOffering> = {}): ProgramOffering {
  return {
    tenantId, programId, offeringId: id, cohortKey: id,
    title: `Course ${id}`, timezone: "America/Guatemala", deliveryMode: "live",
    status: "active", coachIds: [coachUid],
    createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z", ...overrides,
  };
}
function enrollment(learnerId: string, offeringId: string | undefined, overrides: Partial<CommerceEnrollmentRecord> = {}): CommerceEnrollmentRecord {
  return {
    enrollmentId: learnerId, entitlementId: learnerId,
    tenantId, programId, ...(offeringId ? { offeringId } : {}),
    productId: "product", customerId: learnerId, learnerId,
    status: "active", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
    lastProvider: "hotmart", lastProviderEventId: "event", lastEventAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}
function reader(...rows: CommerceEnrollmentRecord[]) {
  return {
    async listByLearner(learnerId: string) { return rows.filter((r) => r.learnerId === learnerId); },
    async sampleActiveLearnerIdsByTenants() { return [...new Set(rows.map((r) => r.learnerId!))]; },
  };
}

describe("single server-side coach program authority", () => {
  it("lists only active course assignments for an institutional coach", () => {
    const rows = [offering("live"), offering("evergreen", { programId: "evergreen", coachIds: [] }),
      offering("foreign", { tenantId: "other" }), offering("draft", { programId: "draft", status: "draft" })];
    expect(authorizedCoachPrograms(coach, coachUid, tenantId, rows).map((x) => x.programId)).toEqual(["premium"]);
    expect(authorizedCoachPrograms(owner, coachUid, tenantId, rows).map((x) => x.programId)).toEqual(["evergreen", "premium"]);
    expect(authorizedCoachPrograms(superuser, coachUid, tenantId, rows).map((x) => x.programId)).toEqual(["evergreen", "premium"]);
    expect(authorizedCoachPrograms({ ...coach, tenantIds: ["other"] }, coachUid, tenantId, rows)).toEqual([]);
  });

  it("denies a tenant-wide coach claim without a program assignment, even for a claimed individual learner", async () => {
    const unassigned = { ...coach, learnerIds: ["student-1"] };
    await expect(requireCoachProgramGrant(unassigned, "unassigned-coach", scope,
      async () => [offering("live")])).rejects.toThrow("COACH_SCOPE_REQUIRED");
    await expect(requireCoachProgramGrant({ ...coach, tenantIds: ["other"] }, coachUid, scope,
      async () => [offering("live")])).rejects.toThrow("COACH_SCOPE_REQUIRED");
  });

  it("derives offering grants freshly on each request, so reassignment takes effect immediately", async () => {
    let allowed = true;
    const load = async () => [offering("live", { coachIds: allowed ? [coachUid] : [] })];
    const granted = await requireCoachProgramGrant(coach, coachUid, scope, load);
    expect(granted.authorizedOfferingIds).toEqual(["live"]);
    allowed = false;
    await expect(requireCoachProgramGrant(coach, coachUid, scope, load)).rejects.toThrow("COACH_SCOPE_REQUIRED");
  });

  it("never exposes program-wide Twin to a coach assigned to only one of two active cohorts", async () => {
    const mixed = [offering("cohort-a"), offering("cohort-b", { coachIds: ["different-coach"] })];
    expect(authorizedCoachPrograms(coach, coachUid, tenantId, mixed)).toEqual([]);
    await expect(requireCoachProgramGrant(coach, coachUid, scope, async () => mixed))
      .rejects.toThrow("COACH_SCOPE_REQUIRED");
    expect(authorizedCoachPrograms(owner, coachUid, tenantId, mixed)).toHaveLength(1);
  });

  it("does not restore coach evidence access by merely archiving a foreign historic cohort", async () => {
    const historical = [offering("cohort-a"), offering("cohort-b", { status: "archived", coachIds: ["other-coach"] })];
    expect(authorizedCoachPrograms(coach, coachUid, tenantId, historical)).toEqual([]);
    await expect(requireCoachProgramGrant(coach, coachUid, scope, async () => historical))
      .rejects.toThrow("COACH_SCOPE_REQUIRED");
    // Explicit admin assignment to all cohorts is necessary until cohort-level Twin isolation.
    historical[1] = offering("cohort-b", { status: "archived", coachIds: [coachUid] });
    const grant = await requireCoachProgramGrant(coach, coachUid, scope, async () => historical);
    expect(grant.authorizedOfferingIds).toEqual(["cohort-a", "cohort-b"]);
  });

  it("refuses revoked/missing offerings and rejects forged program selection", async () => {
    await expect(requireCoachProgramGrant(coach, coachUid, scope,
      async () => [offering("live", { status: "archived" })])).rejects.toThrow("COACH_SCOPE_REQUIRED");
    await expect(requireCoachProgramGrant(coach, coachUid, { tenantId, programId: "unknown" },
      async () => [offering("live")])).rejects.toThrow("COACH_SCOPE_REQUIRED");
  });

  it("requires the learner to have a live enrollment in an authorized offering, not just the program", async () => {
    const granted = await requireCoachProgramGrant(coach, coachUid, scope, async () => [offering("cohort-a")]);
    const rows = reader(enrollment("student-a", "cohort-a"), enrollment("student-b", "cohort-b"),
      enrollment("student-c", undefined), enrollment("student-d", "cohort-a", { status: "revoked" }),
      enrollment("foreign", "cohort-a", { tenantId: "other" }));
    expect(await listScopedCoachLearnerIds(granted, scope, rows, 50)).toEqual(["student-a"]);
    await expect(assertScopedCoachLearner(granted, scope, "student-a", rows)).resolves.toBeUndefined();
    for (const uid of ["student-b", "student-c", "student-d", "foreign"]) {
      await expect(assertScopedCoachLearner(granted, scope, uid, rows)).rejects.toThrow("COACH_LEARNER_SCOPE_FORBIDDEN");
    }
    const visibleToOwner = await listScopedCoachLearnerIds(owner, scope, rows, 50);
    expect(visibleToOwner).toEqual(["student-a", "student-b", "student-c"]);
  });
});
