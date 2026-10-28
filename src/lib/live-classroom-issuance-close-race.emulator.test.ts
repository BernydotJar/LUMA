import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomServiceClient } from "livekit-server-sdk";
import { firebaseAdminFirestore } from "./firebase-admin";
import { FirestoreProgramDeliveryStore, type LiveProgramSession, type ProgramOffering } from "./program-delivery";
import { classroomParticipantId, classroomRoomName } from "./live-classroom";
import { createClassroomToken } from "./live-classroom-server";

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
const store = new FirestoreProgramDeliveryStore(firebaseAdminFirestore);

describe.runIf(enabled)("Firestore Emulator: end-of-classroom versus pending JWT issuance", () => {
  const roomCreate = vi.spyOn(RoomServiceClient.prototype, "createRoom");
  const classFixture = async () => {
    const nonce = randomUUID();
    const offeringId = createHash("sha256").update("offering-" + nonce).digest("hex");
    const sessionId = "session-" + nonce;
    const tenantId = "tenant-" + nonce;
    const roomName = classroomRoomName(tenantId, offeringId, sessionId);
    const now = new Date();
    const offering: ProgramOffering = {
      offeringId, tenantId, programId: "program-qa", cohortKey: nonce,
      title: "Synthetic classroom for closure race", deliveryMode: "live",
      timezone: "America/Guatemala", status: "active", coachIds: ["instructor-qa"],
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    };
    const session: LiveProgramSession = {
      sessionId, offeringId, title: "A controlled session", startsAt: now.toISOString(),
      durationMinutes: 60, classroomProvider: "livekit", recordingPolicy: "none",
      status: "scheduled", createdAt: now.toISOString(), updatedAt: now.toISOString(),
    };
    await firebaseAdminFirestore.collection("programOfferings").doc(offeringId).set(offering);
    await firebaseAdminFirestore.collection("programOfferings").doc(offeringId)
      .collection("sessions").doc(sessionId).set(session);
    const classroom = {
      offering, session, roomName, identity: classroomParticipantId(roomName, "instructor-qa"),
      role: "instructor" as const, uid: "instructor-qa", displayName: "Instructor QA",
      maxParticipants: 4,
    };
    return { classroom, offeringId, sessionId, roomName };
  };

  beforeEach(() => {
    roomCreate.mockReset();
    roomCreate.mockResolvedValue({} as Awaited<ReturnType<RoomServiceClient["createRoom"]>>);
    vi.stubEnv("LUMA_LIVE_CLASSROOM_ENABLED", "true");
    vi.stubEnv("LIVEKIT_URL", "wss://qa.livekit.cloud/");
    vi.stubEnv("LIVEKIT_API_KEY", "synthetic-test-key");
    vi.stubEnv("LIVEKIT_API_SECRET", "synthetic-test-secret-for-emulator");
  });
  afterAll(() => {
    roomCreate.mockRestore();
    vi.unstubAllEnvs();
  });

  it("rejects an in-flight token after a real Firestore completion transaction", async () => {
    const { classroom, offeringId, sessionId } = await classFixture();
    let resume!: () => void;
    let started!: () => void;
    const delayed = new Promise<void>((resolve) => { resume = resolve; });
    const providerStarted = new Promise<void>((resolve) => { started = resolve; });
    roomCreate.mockImplementationOnce(async () => {
      started();
      await delayed;
      return {} as Awaited<ReturnType<RoomServiceClient["createRoom"]>>;
    });
    const request = createClassroomToken(classroom);
    await providerStarted;
    const closed = await store.completeClassroomSession(offeringId, sessionId);
    expect(closed.status).toBe("completed");
    resume();
    await expect(request).rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
    const current = await store.getClassroomSession(offeringId, sessionId);
    expect(current?.session.status).toBe("completed");
  });

  it("refuses an already completed class before calling the media provider", async () => {
    const { classroom, offeringId, sessionId } = await classFixture();
    await store.completeClassroomSession(offeringId, sessionId);
    await expect(createClassroomToken(classroom))
      .rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
    expect(roomCreate).not.toHaveBeenCalled();
  });

  it("refuses a closed room marker with an otherwise scheduled session", async () => {
    const { classroom, roomName } = await classFixture();
    await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName).set({
      tenantId: classroom.offering.tenantId,
      offeringId: classroom.offering.offeringId,
      sessionId: classroom.session.sessionId,
      closeTokensRevokedAt: new Date().toISOString(),
    });
    await expect(createClassroomToken(classroom))
      .rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
    expect(roomCreate).not.toHaveBeenCalled();
  });
});
