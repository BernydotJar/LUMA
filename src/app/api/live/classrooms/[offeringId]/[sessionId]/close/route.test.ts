import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  requireUser: vi.fn(), role: vi.fn(), closeAvailable: vi.fn(),
  configuration: vi.fn(), sessionGet: vi.fn(), sessionComplete: vi.fn(),
  rosterGet: vi.fn(), rosterSet: vi.fn(), issuedGet: vi.fn(),
  listParticipants: vi.fn(), removeParticipant: vi.fn(), deleteRoom: vi.fn(),
}));
const room = "luma_" + "f".repeat(64);
const offeringId = "a".repeat(64);
const sessionId = "session-one";
const instructor = "p_" + "1".repeat(64);
const learnerPresent = "p_" + "2".repeat(64);
const learnerDeparted = "p_" + "3".repeat(64);
const ctx = { params: Promise.resolve({ offeringId, sessionId }) };
const request = () => new Request(
  "https://luma.qa.test/api/live/classrooms/" + offeringId + "/" + sessionId + "/close",
  { method: "POST", headers: { authorization: "Bearer synthetic" } },
);

vi.mock("@/lib/learning-server", () => ({
  requireLearningUser: mocked.requireUser,
}));
vi.mock("@/lib/live-classroom", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/live-classroom")>(),
  classroomCloseAvailable: mocked.closeAvailable,
  classroomRoomName: () => room,
  resolveClassroomRole: mocked.role,
}));
vi.mock("@/lib/live-classroom-server", () => ({
  ClassroomError: class extends Error {
    constructor(readonly reason: string, readonly status: number) { super(reason); }
  },
  liveKitConfiguration: mocked.configuration,
  roomService: () => ({
    listParticipants: mocked.listParticipants,
    removeParticipant: mocked.removeParticipant,
    deleteRoom: mocked.deleteRoom,
  }),
  roomReference: () => ({
    get: mocked.rosterGet,
    set: mocked.rosterSet,
    collection: () => ({
      limit: () => ({ get: mocked.issuedGet }),
    }),
  }),
}));
vi.mock("@/lib/program-delivery-server", () => ({
  programDeliveryStore: {
    getClassroomSession: mocked.sessionGet,
    completeClassroomSession: mocked.sessionComplete,
  },
}));
import { POST } from "./route";
async function close() {
  const response = await POST(request(), ctx);
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocked.requireUser.mockResolvedValue({ uid: "instructor-qa", role: "coach" });
  mocked.role.mockReturnValue("instructor");
  mocked.closeAvailable.mockReturnValue(true);
  mocked.configuration.mockReturnValue({ serverUrl: "wss://qa.livekit.cloud" });
  mocked.sessionGet.mockResolvedValue({
    offering: { tenantId: "qa-tenant", programId: "qa-program" },
    session: { status: "scheduled", classroomProvider: "livekit", recordingPolicy: "none" },
  });
  mocked.sessionComplete.mockResolvedValue({ status: "completed" });
  mocked.rosterGet.mockResolvedValue({ get: () => undefined });
  mocked.rosterSet.mockResolvedValue(undefined);
  mocked.issuedGet.mockResolvedValue({
    size: 3, docs: [instructor, learnerDeparted, learnerPresent].map((id) => ({ id })),
  });
  mocked.listParticipants.mockResolvedValue([
    { identity: instructor }, { identity: learnerPresent },
  ]);
  mocked.removeParticipant.mockResolvedValue(undefined);
  mocked.deleteRoom.mockResolvedValue(undefined);
});

describe("POST classroom close: Cloud revoked token owners", () => {
  it("revokes disconnected roster identities before the room is deleted", async () => {
    const ordering: string[] = [];
    mocked.sessionComplete.mockImplementation(async () => { ordering.push("business-closed"); });
    mocked.removeParticipant.mockImplementation(async (_room: string, id: string) => {
      ordering.push("revoke:" + id);
    });
    mocked.rosterSet.mockImplementation(async () => { ordering.push("fence"); });
    mocked.deleteRoom.mockImplementation(async () => { ordering.push("delete-room"); });

    expect(await close()).toEqual({ status: 200, body: { closed: true } });
    expect(mocked.sessionComplete).toHaveBeenCalledWith(offeringId, sessionId);
    expect(mocked.issuedGet).toHaveBeenCalledOnce();
    expect(mocked.removeParticipant).toHaveBeenCalledTimes(3);
    for (const identity of [instructor, learnerDeparted, learnerPresent]) {
      expect(mocked.removeParticipant).toHaveBeenCalledWith(room, identity, {
        revokeTokenTs: expect.any(BigInt),
      });
    }
    expect(mocked.rosterSet).toHaveBeenCalledWith(
      expect.objectContaining({ closeTokensRevokedCount: 3 }), { merge: true },
    );
    expect(ordering[0]).toBe("business-closed");
    expect(ordering.indexOf("fence")).toBeGreaterThan(ordering.indexOf("revoke:" + learnerDeparted));
    expect(ordering.at(-1)).toBe("delete-room");
  });

  it("returns retryable error when a departed learner's Cloud revocation fails", async () => {
    mocked.removeParticipant.mockImplementation(async (_room: string, id: string) => {
      if (id === learnerDeparted) throw new Error("Cloud unavailable");
    });
    expect(await close()).toEqual({
      status: 503, body: { error: "classroom_close_retryable" },
    });
    expect(mocked.sessionComplete).toHaveBeenCalledOnce();
    expect(mocked.rosterSet).not.toHaveBeenCalled();
    expect(mocked.deleteRoom).not.toHaveBeenCalled();
    mocked.sessionGet.mockResolvedValue({
      offering: { tenantId: "qa-tenant", programId: "qa-program" },
      session: { status: "completed", classroomProvider: "livekit", recordingPolicy: "none" },
    });
    mocked.removeParticipant.mockResolvedValue(undefined);
    expect(await close()).toEqual({ status: 200, body: { closed: true } });
    expect(mocked.deleteRoom).toHaveBeenCalledOnce();
  });

  it("does not re-revoke already fenced identities during a retry", async () => {
    mocked.rosterGet.mockResolvedValue({ get: (field: string) =>
      field === "closeTokensRevokedAt" ? "2026-10-21T05:00:00.000Z" : undefined });
    expect(await close()).toEqual({ status: 200, body: { closed: true } });
    expect(mocked.issuedGet).not.toHaveBeenCalled();
    expect(mocked.removeParticipant).not.toHaveBeenCalled();
    expect(mocked.deleteRoom).toHaveBeenCalledOnce();
  });

  it("allows idempotent deletion only when a credential fence is persisted", async () => {
    mocked.deleteRoom.mockRejectedValue(new Error("room not found"));
    // A real Firestore write becomes visible on the follow-up fence read.
    // The mocked store must model the persisted write, not a perpetually
    // empty snapshot; otherwise a safe idempotent close correctly returns 503.
    mocked.rosterGet.mockResolvedValueOnce({ get: () => undefined })
      .mockResolvedValueOnce({ get: (field: string) =>
        field === "closeTokensRevokedAt" ? "2026-10-21T06:00:00.000Z" : undefined });
    expect(await close()).toEqual({ status: 200, body: { closed: true } });
    expect(mocked.rosterSet).toHaveBeenCalledOnce();
    mocked.rosterSet.mockClear();
    mocked.rosterGet.mockResolvedValue({ get: () => undefined });
    mocked.issuedGet.mockResolvedValue({ size: 0, docs: [] });
    expect(await close()).toEqual({
      status: 503, body: { error: "classroom_close_retryable" },
    });
  });

  it("blocks learner-initiated closure before changing business/provider state", async () => {
    mocked.role.mockReturnValue("learner");
    expect(await close()).toEqual({ status: 403, body: { error: "instructor_only" } });
    expect(mocked.sessionComplete).not.toHaveBeenCalled();
    expect(mocked.removeParticipant).not.toHaveBeenCalled();
  });

  it("refuses oversized token rosters before persisting the close fence", async () => {
    mocked.issuedGet.mockResolvedValue({ size: 1001, docs: [] });
    expect(await close()).toEqual({
      status: 503, body: { error: "classroom_close_retryable" },
    });
    expect(mocked.removeParticipant).not.toHaveBeenCalled();
    expect(mocked.rosterSet).not.toHaveBeenCalled();
    expect(mocked.deleteRoom).not.toHaveBeenCalled();
  });
});
