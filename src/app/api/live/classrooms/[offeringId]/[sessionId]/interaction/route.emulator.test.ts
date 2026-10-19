import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { classroomParticipantId, classroomRoomName } from "@/lib/live-classroom";

const mocked = vi.hoisted(() => ({
  requireUser: vi.fn(),
  authorize: vi.fn(),
  config: vi.fn(),
  updateParticipant: vi.fn(),
  listParticipants: vi.fn(),
  mutePublishedTrack: vi.fn(),
}));
vi.mock("@/lib/learning-server", () => ({ requireLearningUser: mocked.requireUser }));
vi.mock("@/lib/live-classroom-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/live-classroom-server")>();
  return { ...original,
    authorizeClassroom: mocked.authorize,
    liveKitConfiguration: mocked.config,
    roomService: () => ({
      updateParticipant: mocked.updateParticipant,
      listParticipants: mocked.listParticipants,
      mutePublishedTrack: mocked.mutePublishedTrack,
    }),
  };
});
import { POST } from "./route";

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(enabled)("classroom educational controls / actual Firestore transactions", () => {
  let roomName: string;
  let offeringId: string;
  let sessionId: string;
  let learnerId: string;
  let coachId: string;
  let foreignId: string;
  let actor: { uid: string };
  let activeRole: "learner" | "instructor";

  beforeEach(async () => {
    vi.clearAllMocks();
    const suffix = randomUUID();
    offeringId = "a".repeat(64);
    sessionId = `s-${suffix}`;
    roomName = classroomRoomName(`tenant-${suffix}`, offeringId, sessionId);
    learnerId = classroomParticipantId(roomName, `learner-${suffix}`);
    coachId = classroomParticipantId(roomName, `coach-${suffix}`);
    foreignId = classroomParticipantId(roomName, `foreigner-${suffix}`);
    actor = { uid: `learner-${suffix}` };
    activeRole = "learner";
    mocked.requireUser.mockImplementation(async () => actor);
    mocked.authorize.mockImplementation(async () => ({
      role: activeRole,
      identity: activeRole === "learner" ? learnerId : coachId,
      uid: actor.uid,
      roomName,
      offering: { offeringId, tenantId: `tenant-${suffix}` },
      session: { sessionId },
    }));
    mocked.config.mockReturnValue({ serverUrl: "wss://test.livekit.cloud" });
    mocked.updateParticipant.mockResolvedValue({});
    mocked.mutePublishedTrack.mockResolvedValue({});
    mocked.listParticipants.mockResolvedValue([]);
    const room = firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName);
    await room.set({ tenantId: `tenant-${suffix}`, offeringId, sessionId });
    await room.collection("authorized").doc(learnerId).set({ uid: actor.uid, role: "learner" });
    await room.collection("authorized").doc(coachId).set({ uid: `coach-${suffix}`, role: "instructor" });
  });

  async function post(body: Record<string, unknown>) {
    const response = await POST(new Request("https://luma.test/api/live/classrooms/interaction", {
      method: "POST", headers: { authorization: "Bearer test", "content-type": "application/json" },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ offeringId, sessionId }) });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  }

  it("persists hand quota atomically, rejects immediate replay and spoofing", async () => {
    expect(await post({ action: "set_hand", raised: true })).toMatchObject({ status: 200, body: { raised: true } });
    const roster = await firebaseAdminFirestore.collection("liveClassroomRooms")
      .doc(roomName).collection("authorized").doc(learnerId).get();
    expect(typeof roster.get("lastHandControlAt")).toBe("string");
    expect(mocked.updateParticipant).toHaveBeenCalledWith(roomName, learnerId,
      { attributes: { "luma.handRaised": "1" } });
    expect(await post({ action: "set_hand", raised: false })).toMatchObject({ status: 429 });
    expect(await post({ action: "set_hand", identity: foreignId, raised: true })).toMatchObject({ status: 400 });
    expect(mocked.updateParticipant).toHaveBeenCalledTimes(1);
  });

  it("denies banned learner even with a previously authorized room identity", async () => {
    await firebaseAdminFirestore.collection("liveClassroomRooms")
      .doc(roomName).collection("authorized").doc(learnerId).update({ bannedAt: new Date().toISOString() });
    expect(await post({ action: "set_hand", raised: true })).toMatchObject({ status: 403 });
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });

  it("records instructor acknowledgement with an audited, real Firestore transaction", async () => {
    actor = { uid: "coach" };
    activeRole = "instructor";
    expect(await post({ action: "acknowledge_hand", identity: learnerId }))
      .toMatchObject({ status: 200, body: { acknowledged: true } });
    const room = firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName);
    const snapshot = await room.collection("authorized").doc(learnerId).get();
    expect(typeof snapshot.get("lastHandAcknowledgedAt")).toBe("string");
    const events = await room.collection("moderationEvents").get();
    expect(events.docs.map((doc) => doc.data())).toEqual([
      expect.objectContaining({ action: "acknowledge_hand", actorUid: "coach", targetIdentity: learnerId, status: "completed" }),
    ]);
    expect(await post({ action: "acknowledge_hand", identity: learnerId })).toMatchObject({ status: 429 });
  });

  it("mutes only roster-verified learner audio and persists the outcome", async () => {
    actor = { uid: "coach" };
    activeRole = "instructor";
    mocked.listParticipants.mockResolvedValue([
      { identity: learnerId, tracks: [{ sid: "microphone", source: TrackSource.MICROPHONE, muted: false }] },
      { identity: coachId, tracks: [{ sid: "trainer-audio", source: TrackSource.MICROPHONE, muted: false }] },
      { identity: foreignId, tracks: [{ sid: "foreign-audio", source: TrackSource.MICROPHONE, muted: false }] },
    ]);
    expect(await post({ action: "mute_all" })).toMatchObject({ status: 200, body: { muted: 1, failed: 0 } });
    expect(mocked.mutePublishedTrack).toHaveBeenCalledExactlyOnceWith(roomName, learnerId, "microphone", true);
    const room = firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName);
    expect(typeof (await room.get()).get("lastMuteAllAt")).toBe("string");
    const events = await room.collection("moderationEvents").get();
    expect(events.docs.map((doc) => doc.data())).toEqual([
      expect.objectContaining({ action: "mute_all", actorUid: "coach", targetTracks: 1, muted: 1, failed: 0, status: "completed" }),
    ]);
    expect(await post({ action: "mute_all" })).toMatchObject({ status: 429 });
  });
});
