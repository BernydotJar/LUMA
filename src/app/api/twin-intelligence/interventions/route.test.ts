import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireCoach: vi.fn(), resolveScope: vi.fn(), assertLearner: vi.fn(),
  listEvents: vi.fn(), open: vi.fn(), close: vi.fn(), list: vi.fn(),
}));
vi.mock("@/lib/learning-server", () => ({
  requireLearningCoachAccess: mocks.requireCoach,
  learningStoreForScope: () => ({ listEvents: mocks.listEvents }),
}));
vi.mock("@/lib/coach-scoped-learning", () => ({
  resolveCoachLearningScope: mocks.resolveScope,
  assertScopedCoachLearner: mocks.assertLearner,
}));
vi.mock("@/lib/firebase-admin", () => ({ firebaseAdminFirestore: {} }));
vi.mock("@/lib/commerce/server", () => ({ commerceEnrollments: {} }));
vi.mock("@/lib/twin-intelligence/human-store", () => ({
  HumanInterventionStore: class {
    open = mocks.open;
    close = mocks.close;
    listByTeacher = mocks.list;
  },
}));

import { GET, POST, PUT } from "./route";
const scope = { tenantId: "institution-a", programId: "program-pas" };
const interventionId = "a".repeat(64);

const request = (method: "GET" | "POST" | "PUT", data?: unknown) =>
  new Request("https://luma.example.test/api/twin-intelligence/interventions", {
    method,
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

beforeEach(() => {
  process.env.LUMA_TWIN_PILOT_ENABLED = "true";
  process.env.LUMA_TWIN_PILOT_TENANT_ID = scope.tenantId;
  process.env.LUMA_TWIN_PILOT_PROGRAM_ID = scope.programId;
  process.env.LUMA_TWIN_PILOT_TEACHER_UID = "teacher-1";
  mocks.requireCoach.mockReset().mockResolvedValue({
    decoded: { uid: "teacher-1" },
    access: { unrestricted: false, tenantIds: [scope.tenantId], learnerIds: [] },
  });
  mocks.resolveScope.mockReset().mockReturnValue(scope);
  mocks.assertLearner.mockReset().mockResolvedValue(undefined);
  mocks.listEvents.mockReset().mockResolvedValue([
    { id: "ev-1", recordedAt: "2026-10-10T12:00:00Z" },
    { id: "ev-2", recordedAt: "2026-10-15T12:00:00Z" },
  ]);
  mocks.open.mockReset().mockResolvedValue({ interventionId, status: "OPEN" });
  mocks.close.mockReset().mockResolvedValue({ interventionId, status: "COMPLETED" });
  mocks.list.mockReset().mockResolvedValue([{ learnerId: "student-1", interventionId }]);
});

describe("P0 human intervention API authorization", () => {
  it("requires a server-verified learner event before opening", async () => {
    expect((await POST(request("POST", {
      learnerId: "student-1", reasonEventId: "not-found", idempotencyKey: "open-1",
    }))).status).toBe(409);
    expect(mocks.open).not.toHaveBeenCalled();
    expect((await POST(request("POST", {
      learnerId: "student-1", reasonEventId: "ev-1", idempotencyKey: "open-1",
    }))).status).toBe(201);
    expect(mocks.open).toHaveBeenCalledWith(scope, "teacher-1", "student-1", "ev-1", "open-1");
  });
  it("cannot open or list another institution's data", async () => {
    mocks.resolveScope.mockReturnValueOnce({ tenantId: "other", programId: scope.programId });
    expect((await POST(request("POST", {
      learnerId: "student-1", reasonEventId: "ev-1", idempotencyKey: "open-1",
    }))).status).toBe(403);
    expect(mocks.assertLearner).not.toHaveBeenCalled();
    mocks.assertLearner.mockRejectedValueOnce(new Error("COACH_LEARNER_SCOPE_FORBIDDEN"));
    expect((await POST(request("POST", {
      learnerId: "student-1", reasonEventId: "ev-1", idempotencyKey: "open-1",
    }))).status).toBe(403);
    mocks.assertLearner.mockRejectedValueOnce(new Error("COACH_LEARNER_SCOPE_FORBIDDEN"));
    expect((await GET(request("GET"))).status).toBe(200);
    const body = await (await GET(request("GET"))).json();
    expect(body.interventions.length).toBe(1);
  });
  it("requires a persisted follow-up before closing as completed", async () => {
    expect((await PUT(request("PUT", {
      learnerId: "student-1", interventionId,
      expectedRevision: 1, outcome: "COMPLETED", followUpEventId: "unverified",
    }))).status).toBe(409);
    expect(mocks.close).not.toHaveBeenCalled();
    const valid = await PUT(request("PUT", {
      learnerId: "student-1", interventionId,
      expectedRevision: 1, outcome: "COMPLETED", followUpEventId: "ev-2",
    }));
    expect(valid.status).toBe(200);
    expect(mocks.close).toHaveBeenCalledWith(scope, "teacher-1", "student-1",
      interventionId, 1, "COMPLETED", "ev-2", "2026-10-15T12:00:00Z");
  });
  it("is disabled unless pilot configuration explicitly enables it", async () => {
    delete process.env.LUMA_TWIN_PILOT_ENABLED;
    expect((await GET(request("GET"))).status).toBe(404);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
