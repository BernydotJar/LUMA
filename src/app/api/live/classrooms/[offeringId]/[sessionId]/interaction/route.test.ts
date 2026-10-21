import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrackSource } from "livekit-server-sdk";
import { ClassroomError } from "@/lib/live-classroom-server";

const mocked = vi.hoisted(() => ({
  user: { uid: "learner-user" },
  role: "learner" as "learner" | "instructor",
  requireUser: vi.fn(),
  authorize: vi.fn(),
  config: vi.fn(),
  rosterGet: vi.fn(),
  auditCreate: vi.fn(),
  auditUpdate: vi.fn(),
  txGet: vi.fn(),
  txSet: vi.fn(),
  runTransaction: vi.fn(),
  getAll: vi.fn(),
  updateParticipant: vi.fn(),
  listParticipants: vi.fn(),
  mutePublishedTrack: vi.fn(),
}));
const learnerIdentity = "p_" + "a".repeat(64);
const instructorIdentity = "p_" + "b".repeat(64);
const foreignIdentity = "p_" + "c".repeat(64);
const offeringId = "f".repeat(64);
const sessionId = "session-live-1";
const roomName = "luma_" + "e".repeat(64);
const get = (field: string) => ({ uid: mocked.user.uid, role: mocked.role,
  tenantId: "tenant-a", offeringId, sessionId }[field]);

vi.mock("@/lib/learning-server", () => ({ requireLearningUser: mocked.requireUser }));
vi.mock("@/lib/firebase-admin", () => ({ firebaseAdminFirestore: {
  runTransaction: mocked.runTransaction, getAll: mocked.getAll,
} }));
vi.mock("@/lib/live-classroom-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/live-classroom-server")>();
  return {
    ...original,
    authorizeClassroom: mocked.authorize,
    liveKitConfiguration: mocked.config,
    roomService: () => ({
      updateParticipant: mocked.updateParticipant,
      listParticipants: mocked.listParticipants,
      mutePublishedTrack: mocked.mutePublishedTrack,
    }),
    roomReference: () => ({
      collection: () => ({ doc: (identity?: string) => identity
        ? ({ id: identity, get: mocked.rosterGet })
        : ({ create: mocked.auditCreate, update: mocked.auditUpdate }) }),
    }),
  };
});

import { POST } from "./route";

function fakeRequest(body: unknown, token = "test-token") {
  return new Request(`https://luma.example.test/api/live/classrooms/${offeringId}/${sessionId}/interaction`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ offeringId, sessionId }) };

async function request(body: unknown) {
  const result = await POST(fakeRequest(body), ctx);
  return { status: result.status, data: await result.json() as Record<string, unknown> };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.role = "learner";
  mocked.user = { uid: "learner-user" };
  mocked.requireUser.mockResolvedValue(mocked.user);
  mocked.authorize.mockImplementation(async () => ({
    role: mocked.role,
    identity: mocked.role === "learner" ? learnerIdentity : instructorIdentity,
    uid: mocked.user.uid,
    roomName,
    offering: { offeringId, tenantId: "tenant-a" },
    session: { sessionId },
  }));
  mocked.config.mockReturnValue({ serverUrl: "wss://test.livekit.cloud" });
  mocked.runTransaction.mockImplementation(async (callback) => callback({
    get: mocked.txGet, set: mocked.txSet,
  }));
  mocked.txGet.mockResolvedValue({ exists: true, get });
  mocked.rosterGet.mockResolvedValue({ exists: true, get: (field: string) => field === "role" ? "learner" : undefined });
  mocked.getAll.mockImplementation(async (...refs) => refs.map((ref: { id: string }) => ({
    id: ref.id,
    get: (field: string) => field === "role" ? ref.id === instructorIdentity ? "instructor" : "learner" : undefined,
  })));
  mocked.auditCreate.mockResolvedValue(undefined);
  mocked.auditUpdate.mockResolvedValue(undefined);
  mocked.updateParticipant.mockResolvedValue({});
  mocked.listParticipants.mockResolvedValue([]);
  mocked.mutePublishedTrack.mockResolvedValue({});
});

describe("POST classroom interaction authorization / provider contract", () => {
  it("rejects guests before touching media or datastore", async () => {
    mocked.requireUser.mockRejectedValue(new Error("AUTH_REQUIRED"));
    expect(await request({ action: "set_hand", raised: true })).toMatchObject({ status: 401 });
    expect(mocked.authorize).not.toHaveBeenCalled();
    expect(mocked.config).not.toHaveBeenCalled();
  });
  it("rejects target spoofing, unknown verbs and invalid payloads before the provider", async () => {
    for (const body of [
      { action: "set_hand", raised: true, identity: foreignIdentity },
      { action: "mute_all", identities: [learnerIdentity] },
      { action: "acknowledge_hand", identity: "raw-user-id" },
      { action: "set_hand", raised: 1 },
    ]) expect((await request(body)).status).toBe(400);
    expect(mocked.authorize).not.toHaveBeenCalled();
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });
  it("returns 413 on oversized JSON, not a provider error", async () => {
    const big = fakeRequest({ action: "mute_all", padding: "x".repeat(1500) });
    const response = await POST(big, ctx);
    expect(response.status).toBe(413);
    expect(mocked.authorize).not.toHaveBeenCalled();
  });
  it("only updates the authenticated learner identity and server-controlled attribute", async () => {
    expect(await request({ action: "set_hand", raised: true })).toMatchObject({ status: 200, data: { raised: true } });
    expect(mocked.updateParticipant).toHaveBeenCalledWith(roomName, learnerIdentity,
      { attributes: { "luma.handRaised": "1" } });
    expect(mocked.runTransaction).toHaveBeenCalledTimes(1);
    expect(mocked.txSet).toHaveBeenCalledOnce();
    expect(await request({ action: "set_hand", raised: false })).toMatchObject({ status: 200, data: { raised: false } });
    expect(mocked.updateParticipant).toHaveBeenLastCalledWith(roomName, learnerIdentity,
      { attributes: { "luma.handRaised": "" } });
  });
  it("revoked/banned learners cannot change hand state", async () => {
    mocked.txGet.mockResolvedValue({ exists: true, get: (field: string) => field === "bannedAt" ? "2026-10-18" : get(field) });
    expect(await request({ action: "set_hand", raised: true })).toMatchObject({ status: 403 });
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });
  it("enforces atomic anti-spam quota on the authenticated learner", async () => {
    mocked.txGet.mockResolvedValue({ exists: true, get: (field: string) =>
      field === "lastHandControlAt" ? new Date().toISOString() : get(field) });
    expect(await request({ action: "set_hand", raised: true })).toMatchObject({ status: 429 });
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });
  it("denies group moderation and acknowledging hands to learners", async () => {
    for (const body of [{ action: "mute_all" }, { action: "acknowledge_hand", identity: foreignIdentity }]) {
      expect(await request(body)).toMatchObject({ status: 403, data: { error: "instructor_only" } });
    }
    expect(mocked.listParticipants).not.toHaveBeenCalled();
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });
  it("does not allow trainers to raise an instructor hand", async () => {
    mocked.role = "instructor";
    expect(await request({ action: "set_hand", raised: true })).toMatchObject({ status: 403 });
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });
  it("authorizes trainer acknowledgement only for persisted learner role", async () => {
    mocked.role = "instructor";
    mocked.txGet.mockResolvedValue({ exists: true, get: (field: string) => field === "role" ? "learner" : undefined });
    expect(await request({ action: "acknowledge_hand", identity: learnerIdentity })).toMatchObject({ status: 200 });
    expect(mocked.updateParticipant).toHaveBeenCalledWith(roomName, learnerIdentity,
      { attributes: { "luma.handRaised": "" } });
    expect(mocked.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      action: "acknowledge_hand", targetIdentity: learnerIdentity, status: "pending",
    }));
    expect(mocked.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    mocked.txGet.mockResolvedValue({ exists: true, get: (field: string) => field === "role" ? "instructor" : undefined });
    expect(await request({ action: "acknowledge_hand", identity: foreignIdentity })).toMatchObject({ status: 404 });
  });
  it("throttles instructor acknowledgement and fails closed before provider mutation", async () => {
    mocked.role = "instructor";
    mocked.txGet.mockResolvedValue({ exists: true, get: (field: string) =>
      field === "role" ? "learner" : field === "lastHandAcknowledgedAt" ? new Date().toISOString() : undefined });
    expect(await request({ action: "acknowledge_hand", identity: learnerIdentity })).toMatchObject({ status: 429 });
    expect(mocked.auditCreate).not.toHaveBeenCalled();
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });
  it("keeps moderation audited when the provider rejects the change", async () => {
    mocked.role = "instructor";
    mocked.txGet.mockResolvedValue({ exists: true, get: (field: string) => field === "role" ? "learner" : undefined });
    mocked.updateParticipant.mockRejectedValue(new Error("provider rejected"));
    expect(await request({ action: "acknowledge_hand", identity: learnerIdentity })).toMatchObject({ status: 503 });
    expect(mocked.auditCreate).toHaveBeenCalledOnce();
    expect(mocked.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "provider_failed" }));
  });
  it("does not mutate provider state when the moderation audit intent cannot be persisted", async () => {
    mocked.role = "instructor";
    mocked.txGet.mockResolvedValue({ exists: true, get: (field: string) => field === "role" ? "learner" : undefined });
    mocked.auditCreate.mockRejectedValue(new Error("firestore unavailable"));
    expect(await request({ action: "acknowledge_hand", identity: learnerIdentity })).toMatchObject({ status: 503 });
    expect(mocked.updateParticipant).not.toHaveBeenCalled();
  });
  it("mutes only roster-verified active learner microphones, never instructors or screen shares", async () => {
    mocked.role = "instructor";
    mocked.listParticipants.mockResolvedValue([
      { identity: learnerIdentity, tracks: [{ sid: "mic-a", source: TrackSource.MICROPHONE, muted: false },
        { sid: "display", source: TrackSource.SCREEN_SHARE_AUDIO, muted: false }] },
      { identity: instructorIdentity, tracks: [{ sid: "mic-b", source: TrackSource.MICROPHONE, muted: false }] },
    ]);
    const result = await request({ action: "mute_all" });
    expect(result).toMatchObject({ status: 200, data: { muted: 1, failed: 0, status: "completed", canReenableMicrophones: true } });
    expect(mocked.mutePublishedTrack).toHaveBeenCalledExactlyOnceWith(roomName, learnerIdentity, "mic-a", true);
    expect(mocked.auditCreate).toHaveBeenCalledWith(expect.objectContaining({ action: "mute_all", targetTracks: 1 }));
    expect(mocked.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", muted: 1, failed: 0 }));
  });
  it("discloses partial provider failures rather than claiming complete success", async () => {
    mocked.role = "instructor";
    mocked.listParticipants.mockResolvedValue([
      { identity: learnerIdentity, tracks: [{ sid: "mic-a", source: TrackSource.MICROPHONE, muted: false }] },
      { identity: foreignIdentity, tracks: [{ sid: "mic-b", source: TrackSource.MICROPHONE, muted: false }] },
    ]);
    mocked.mutePublishedTrack.mockImplementation(async (_room, _id, sid: string) => {
      if (sid === "mic-b") throw new Error("provider failed");
      return {};
    });
    expect(await request({ action: "mute_all" })).toMatchObject({ status: 207, data: { muted: 1, failed: 1, status: "partial" } });
    expect(mocked.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "partial", muted: 1, failed: 1 }));
  });
  it("refuses capacity greater than the controlled mute-all limit", async () => {
    mocked.role = "instructor";
    mocked.listParticipants.mockResolvedValue(Array.from({ length: 121 }, (_, i) => ({ identity: `p_${String(i).padStart(64, "0")}`, tracks: [] })));
    expect(await request({ action: "mute_all" })).toMatchObject({ status: 409, data: { error: "classroom_exceeds_moderation_limit" } });
    expect(mocked.mutePublishedTrack).not.toHaveBeenCalled();
  });
  it("denies media changes when provider is not configured", async () => {
    mocked.config.mockImplementation(() => { throw new ClassroomError("classroom_not_enabled", 503); });
    expect(await request({ action: "set_hand", raised: true })).toMatchObject({ status: 503, data: { error: "classroom_not_enabled" } });
    expect(mocked.runTransaction).not.toHaveBeenCalled();
  });
  it("provider programming errors fail as 503, never as a false successful client request", async () => {
    mocked.updateParticipant.mockRejectedValue(new TypeError("provider connection failed"));
    expect(await request({ action: "set_hand", raised: true })).toMatchObject({ status: 503, data: { error: "classroom_control_unavailable" } });
  });
});
