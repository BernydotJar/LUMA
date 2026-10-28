import { beforeEach, describe, expect, it, vi } from "vitest";
import { methodDigest, type TeachingTwinMethod } from "@/lib/twin-intelligence/contracts";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(), requireEntitlement: vi.fn(),
  get: vi.fn(), readApproved: vi.fn(),
}));
vi.mock("@/lib/learning-server", () => ({
  requireLearningUser: mocks.requireUser,
  learningStoreForScope: () => ({ get: mocks.get }),
}));
vi.mock("@/lib/learning-entitlement-server", () => ({
  requireLearningEntitlement: mocks.requireEntitlement,
}));
vi.mock("@/lib/firebase-admin", () => ({ firebaseAdminFirestore: {} }));
vi.mock("@/lib/twin-intelligence/teaching-store", () => ({
  TeachingTwinStore: class { readApproved = mocks.readApproved; },
}));

import { GET } from "./route";

const scope = { tenantId: "institution-a", programId: "program-pas" };
const method: TeachingTwinMethod = {
  title: "PAS Socratic", objective: "Apply source evidence",
  pedagogicalPrinciples: ["Questions first"],
  strategies: {
    explain: { instruction: "Show example", approvedSourceIds: ["source-a"] },
    practice: { instruction: "Practice", approvedSourceIds: ["source-b"] },
    remediate: { instruction: "Contrast", approvedSourceIds: ["source-c"] },
  },
  escalation: { consecutiveFailures: 2, confidenceBelow: 0.4 },
  assessment: { rubricId: "r1", rubricVersion: "v1", criterionIds: ["first", "second"] },
};
const teacher = {
  schemaVersion: 1, revision: 1, ...scope, teacherUid: "teacher-1",
  status: "APPROVED", method, methodSha256: methodDigest(method),
  createdAt: "2026-10-01T00:00:00Z", approvedAt: "2026-10-02T00:00:00Z",
};

beforeEach(() => {
  process.env.LUMA_TWIN_PILOT_ENABLED = "true";
  process.env.LUMA_TWIN_PILOT_TENANT_ID = scope.tenantId;
  process.env.LUMA_TWIN_PILOT_PROGRAM_ID = scope.programId;
  process.env.LUMA_TWIN_PILOT_TEACHER_UID = "teacher-1";
  mocks.requireUser.mockReset().mockResolvedValue({ uid: "student-one" });
  mocks.requireEntitlement.mockReset().mockResolvedValue(scope);
  mocks.readApproved.mockReset().mockResolvedValue(teacher);
  mocks.get.mockReset().mockResolvedValue({
    record: { version: 2, state: { learnerId: "student-one", goal: "communication",
      availableMinutes: 8, concepts: [{ conceptId: "pas", label: "P.A.S.",
        attempts: 2, consecutiveFailures: 2, confidence: 0.3,
        mastery: 0.4, completedContent: true, prerequisiteIds: [] }] } },
    plan: { nextAction: { id: "practice-1", conceptId: "pas", reason: "Review",
      confidence: 0.6, kind: "practice" } },
  });
});

const request = () => new Request("https://luma.example.test/api/twin-intelligence/next-action", {
  headers: { authorization: "Bearer synthetic-token", "x-luma-program-id": scope.programId },
});

describe("Twin next-action learner boundary", () => {
  it("does not mutate learner state and requires an approved teaching method", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.recommendation.requiresHumanReview).toBe(true);
    expect(body.recommendation.masteryMutationAuthorized).toBe(false);
    expect(body.authority.generativeAiUsed).toBe(false);
    expect(mocks.requireUser).toHaveBeenCalledWith(expect.any(Request), { checkRevoked: true });
    expect(mocks.get).toHaveBeenCalledWith("student-one");
  });
  it("forbids a second tenant despite a valid student token", async () => {
    mocks.requireEntitlement.mockResolvedValueOnce({ tenantId: "institution-b", programId: scope.programId });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.get).not.toHaveBeenCalled();
  });
  it("rejects a missing approval or missing learner record", async () => {
    mocks.readApproved.mockResolvedValueOnce(undefined);
    expect((await GET(request())).status).toBe(409);
    mocks.get.mockResolvedValueOnce(undefined);
    expect((await GET(request())).status).toBe(404);
  });
  it("is inaccessible by default", async () => {
    delete process.env.LUMA_TWIN_PILOT_ENABLED;
    expect((await GET(request())).status).toBe(404);
  });
});
