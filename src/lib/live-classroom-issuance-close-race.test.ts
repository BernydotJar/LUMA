import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  sessionStatus: "scheduled" as "scheduled" | "completed",
  roomClosed: false,
  rosterBanned: false,
  sign: vi.fn(),
  createRoom: vi.fn(),
  read: vi.fn(),
}));
const offeringId = "a".repeat(64);
const sessionId = "meeting-qa";
const roomName = "luma_" + "e".repeat(64);
const userId = "p_" + "a".repeat(64);
const sessionRef = { kind: "session", get: async () => snap({ kind: "session" }) };
const roomRef = {
  kind: "room", get: async () => snap({ kind: "room" }),
  collection: () => ({ doc: () => rosterRef }),
};
const rosterRef = { kind: "roster", get: async () => snap({ kind: "roster" }) };
const snap = (ref: { kind: string }) => {
  if (ref.kind === "session") {
    return {
      exists: true,
      data: () => ({ offeringId, sessionId, classroomProvider: "livekit", status: state.sessionStatus }),
    };
  }
  if (ref.kind === "room") {
    return {
      exists: true,
      data: () => ({ tenantId: "tenant-qa", offeringId, sessionId }),
      get: (field: string) => field === "closeTokensRevokedAt" && state.roomClosed
        ? "2026-10-21T03:00:00.000Z" : undefined,
    };
  }
  return {
    exists: true, data: () => ({}),
    get: (field: string) => field === "bannedAt" && state.rosterBanned
      ? "2026-10-21T03:00:00.000Z" : undefined,
  };
};
vi.mock("./firebase-admin", () => ({
  firebaseAdminFirestore: {
    collection: (name: string) => ({
      doc: () => name === "programOfferings"
        ? { collection: () => ({ doc: () => sessionRef }) }
        : roomRef,
    }),
    runTransaction: async (fn: (transaction: unknown) => Promise<unknown>) => fn({
      get: async (ref: { kind: string }) => {
        state.read(ref.kind);
        return snap(ref);
      },
      set: vi.fn(), create: vi.fn(),
    }),
  },
}));
vi.mock("livekit-server-sdk", () => ({
  RoomServiceClient: class { createRoom = state.createRoom; },
}));
vi.mock("./live-classroom-token", () => ({
  signClassroomJoinToken: state.sign,
}));
vi.mock("./commerce/server", () => ({
  commerceEnrollments: { listByLearner: vi.fn().mockResolvedValue([]) },
}));

import { createClassroomToken } from "./live-classroom-server";
const classroom = {
  offering: { offeringId, tenantId: "tenant-qa", programId: "program-qa" },
  session: { sessionId, status: "scheduled", classroomProvider: "livekit", recordingPolicy: "none" },
  roomName, identity: userId, role: "instructor",
  uid: "instructor-qa", displayName: "QA instructor", maxParticipants: 5,
} as Parameters<typeof createClassroomToken>[0];

beforeEach(() => {
  vi.clearAllMocks();
  state.sessionStatus = "scheduled";
  state.roomClosed = false;
  state.rosterBanned = false;
  state.createRoom.mockResolvedValue(undefined);
  state.sign.mockResolvedValue("SYNTHETIC_ISSUED_JWT");
  vi.stubEnv("LUMA_LIVE_CLASSROOM_ENABLED", "true");
  vi.stubEnv("LIVEKIT_URL", "wss://qa.livekit.cloud/");
  vi.stubEnv("LIVEKIT_API_KEY", "synthetic-test-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "synthetic-test-secret");
});

describe("class close and new token issuance are serialized against persisted session status", () => {
  it("rejects the signed JWT when the session finishes while room creation is pending", async () => {
    let resume!: () => void;
    let pendingRoomStarted!: () => void;
    const pendingProvider = new Promise<void>((resolve) => { resume = resolve; });
    const began = new Promise<void>((resolve) => { pendingRoomStarted = resolve; });
    state.createRoom.mockImplementation(async () => {
      pendingRoomStarted();
      await pendingProvider;
    });
    const promise = createClassroomToken(classroom);
    await began;
    state.sessionStatus = "completed";
    resume();
    await expect(promise).rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
  });

  it("does not register another issued identity after session completion", async () => {
    state.sessionStatus = "completed";
    await expect(createClassroomToken(classroom))
      .rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
    expect(state.createRoom).not.toHaveBeenCalled();
  });

  it("denies issuance if the room has a durable close fence despite a stale scheduled snapshot", async () => {
    state.roomClosed = true;
    await expect(createClassroomToken(classroom))
      .rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
    expect(state.createRoom).not.toHaveBeenCalled();
  });

  it("denies a token if completion happens asynchronously while it is being signed", async () => {
    state.sign.mockImplementation(async () => {
      state.sessionStatus = "completed";
      return "SYNTHETIC_ISSUED_JWT";
    });
    await expect(createClassroomToken(classroom))
      .rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
  });

  it("preserves legitimate scheduled instructor admission", async () => {
    await expect(createClassroomToken(classroom)).resolves.toMatchObject({
      role: "instructor", token: "SYNTHETIC_ISSUED_JWT",
    });
    expect(state.createRoom).toHaveBeenCalledOnce();
  });
});
