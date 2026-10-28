import { beforeEach, describe, expect, it, vi } from "vitest";
import { method } from "@/lib/twin-intelligence/contracts.test";
import { methodDigest } from "@/lib/twin-intelligence/contracts";

const mocks = vi.hoisted(() => ({
  requireCoach: vi.fn(), resolveCoachScope: vi.fn(),
  readDraft: vi.fn(), readApproved: vi.fn(), saveDraft: vi.fn(), approve: vi.fn(),
}));
vi.mock("@/lib/learning-server", () => ({
  requireLearningCoachAccess: mocks.requireCoach,
}));
vi.mock("@/lib/coach-scoped-learning", () => ({
  resolveCoachLearningScope: mocks.resolveCoachScope,
}));
vi.mock("@/lib/firebase-admin", () => ({ firebaseAdminFirestore: {} }));
vi.mock("@/lib/twin-intelligence/teaching-store", () => ({
  TeachingTwinStore: class {
    readDraft = mocks.readDraft;
    readApproved = mocks.readApproved;
    saveDraft = mocks.saveDraft;
    approve = mocks.approve;
  },
}));

import { GET, PUT, POST } from "./route";

const scope = { tenantId: "institution-a", programId: "program-pas" };
const approved = {
  schemaVersion: 1, revision: 1, ...scope, teacherUid: "teacher-1",
  method, methodSha256: methodDigest(method), status: "APPROVED",
  createdAt: "2026-10-01T00:00:00Z", approvedAt: "2026-10-02T00:00:00Z",
};

beforeEach(() => {
  process.env.LUMA_TWIN_PILOT_ENABLED = "true";
  process.env.LUMA_TWIN_PILOT_TENANT_ID = scope.tenantId;
  process.env.LUMA_TWIN_PILOT_PROGRAM_ID = scope.programId;
  process.env.LUMA_TWIN_PILOT_TEACHER_UID = "teacher-1";
  mocks.requireCoach.mockReset().mockResolvedValue({
    decoded: { uid: "teacher-1" },
    access: { unrestricted: false, tenantIds: [scope.tenantId], learnerIds: [] },
  });
  mocks.resolveCoachScope.mockReset().mockReturnValue(scope);
  mocks.readDraft.mockReset().mockResolvedValue(undefined);
  mocks.readApproved.mockReset().mockResolvedValue(approved);
  mocks.saveDraft.mockReset().mockResolvedValue({ ...approved, status: "DRAFT" });
  mocks.approve.mockReset().mockResolvedValue(approved);
});

function req(methodName: string, value?: unknown) {
  return new Request("https://luma.example.test/api/twin-intelligence/teaching-twin", {
    method: methodName, headers: { "content-type": "application/json" },
    ...(value ? { body: JSON.stringify(value) } : {}),
  });
}

describe("P0 Teaching Twin HTTP authorization", () => {
  it("never exposes any draft when feature is disabled", async () => {
    delete process.env.LUMA_TWIN_PILOT_ENABLED;
    const res = await GET(req("GET"));
    expect(res.status).toBe(404);
    expect(mocks.readDraft).not.toHaveBeenCalled();
  });
  it("denies unassigned coach, teacher, and cross-tenant requests", async () => {
    mocks.requireCoach.mockRejectedValueOnce(new Error("COACH_REQUIRED"));
    expect((await GET(req("GET"))).status).toBe(403);
    mocks.resolveCoachScope.mockReturnValueOnce({ tenantId: "institution-b", programId: "program-pas" });
    expect((await GET(req("GET"))).status).toBe(403);
    mocks.requireCoach.mockResolvedValueOnce({ decoded: { uid: "other" },
      access: { tenantIds: [scope.tenantId], learnerIds: [], unrestricted: false } });
    expect((await GET(req("GET"))).status).toBe(403);
    expect(mocks.readApproved).not.toHaveBeenCalled();
  });
  it("requires teacher to draft, then approve, using server identity", async () => {
    const draftRes = await PUT(req("PUT", { method, expectedRevision: 0 }));
    expect(draftRes.status).toBe(201);
    expect(mocks.saveDraft).toHaveBeenCalledWith(scope, "teacher-1", method, 0);
    const approveRes = await POST(req("POST", { action: "approve", expectedRevision: 1 }));
    expect(approveRes.status).toBe(200);
    expect(mocks.approve).toHaveBeenCalledWith(scope, "teacher-1", 1);
  });
  it("rejects malformed methodology and oversized requests", async () => {
    expect((await PUT(req("PUT", { method: { title: "only title" }, expectedRevision: 0 }))).status).toBe(400);
    const payload = JSON.stringify({ method, expectedRevision: 0 }) + " ".repeat(12_000);
    const res = await PUT(new Request("https://luma.example.test", { method: "PUT", body: payload }));
    expect(res.status).toBe(413);
    expect(mocks.saveDraft).not.toHaveBeenCalled();
  });
});
