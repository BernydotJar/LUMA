import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { firebaseAdminFirestore } from "./firebase-admin";
import { classroomParticipantId, classroomRoomName } from "./live-classroom";
import { revocationJobId } from "./live-classroom-revocation-queue";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";

const provider = vi.hoisted(() => ({ removeParticipant: vi.fn(), createRoom: vi.fn() }));
vi.mock("./live-classroom-server", async (importOriginal) => {
  const base = await importOriginal<typeof import("./live-classroom-server")>();
  return { ...base, liveKitConfiguration: () => ({
    serverUrl: "wss://dummy.livekit.cloud", httpUrl: "https://dummy.livekit.cloud",
    apiKey: "LOCAL_TEST_KEY", apiSecret: "local-test-only-signing-secret-0123456789",
  }), roomService: () => ({ removeParticipant: provider.removeParticipant,
    createRoom: provider.createRoom }) };
});
import { dispatchClassroomRevocation, disconnectIfClassroomAccessRevoked } from "./live-classroom-revocation";
import { createClassroomToken } from "./live-classroom-server";

const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;

describe.runIf(enabled)("durable entitlement revocation -> immediate connected participant removal", () => {
  let enrollment: CommerceEnrollmentRecord;
  let roomName: string;
  let identity: string;
  let sessionId: string;
  let jobId: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    provider.removeParticipant.mockResolvedValue(undefined);
    provider.createRoom.mockResolvedValue({});
    const suffix = randomUUID();
    const tenantId = `tenant-${suffix}`;
    const learnerId = `learner-${suffix}`;
    const offeringId = `offering-${suffix}`;
    sessionId = `session-${suffix}`;
    const enrollmentId = "f".repeat(64 - 32) + suffix.replaceAll("-", "");
    roomName = classroomRoomName(tenantId, offeringId, sessionId);
    identity = classroomParticipantId(roomName, learnerId);
    enrollment = {
      enrollmentId, entitlementId: enrollmentId, tenantId, learnerId, offeringId,
      programId: "program", productId: "product", customerId: "customer",
      status: "revoked", lastProvider: "hotmart", lastProviderEventId: `refund-${suffix}`,
      lastEventAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    jobId = revocationJobId({ enrollmentId, sourceEventId: enrollment.lastProviderEventId });
    await firebaseAdminFirestore.collection("commerceEnrollments").doc(enrollmentId).set(enrollment);
    await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName).set({
      tenantId, offeringId, sessionId, recordingPolicy: "none", createdAt: new Date().toISOString(),
    });
    await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName)
      .collection("authorized").doc(identity).set({ uid: learnerId, role: "learner" });
    await firebaseAdminFirestore.collection("liveClassroomRevocations").doc(jobId).set({
      jobId, enrollmentId, tenantId, offeringId, learnerId,
      sourceEventId: enrollment.lastProviderEventId,
      state: "pending", attempts: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  });

  afterAll(() => vi.clearAllMocks());

  it("bans provider identity, revokes its outstanding token and completes a durable job", async () => {
    const result = await dispatchClassroomRevocation(enrollment);
    expect(result).toEqual({ state: "completed", evicted: 1 });
    expect(provider.removeParticipant).toHaveBeenCalledWith(roomName, identity,
      expect.objectContaining({ revokeTokenTs: expect.any(BigInt) }));
    const roster = await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName)
      .collection("authorized").doc(identity).get();
    expect(roster.get("bannedAt")).toBeTruthy();
    expect(roster.get("banReason")).toBe("enrollment_revoked");
    const job = await firebaseAdminFirestore.collection("liveClassroomRevocations").doc(jobId).get();
    expect(job.data()).toMatchObject({ state: "completed", evicted: 1, rosterMatches: 1, attempts: 1 });
    expect(await dispatchClassroomRevocation(enrollment)).toEqual({ state: "completed", evicted: 0 });
    expect(provider.removeParticipant).toHaveBeenCalledTimes(1);
  });

  it("preserves an instructor ban during a subsequent payment revocation", async () => {
    const rosterRef = firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName)
      .collection("authorized").doc(identity);
    const instructorBan = "2026-10-19T20:00:00Z";
    await rosterRef.update({ bannedAt: instructorBan, banReason: "instructor_removed" });
    await dispatchClassroomRevocation(enrollment);
    const record = await rosterRef.get();
    expect(record.get("bannedAt")).toBe(instructorBan);
    expect(record.get("banReason")).toBe("instructor_removed");
  });

  it("refuses a missing durable outbox rather than acknowledging a refund as safe", async () => {
    await firebaseAdminFirestore.collection("liveClassroomRevocations").doc(jobId).delete();
    await expect(dispatchClassroomRevocation(enrollment))
      .rejects.toThrow("CLASSROOM_REVOCATION_JOB_MISSING");
    expect(provider.removeParticipant).not.toHaveBeenCalled();
  });

  it("fails closed on provider failure, persists retryable job and retries safely", async () => {
    provider.removeParticipant.mockRejectedValueOnce(new Error("provider timeout"));
    await expect(dispatchClassroomRevocation(enrollment)).rejects.toThrow("CLASSROOM_REVOCATION_RETRYABLE");
    const job = firebaseAdminFirestore.collection("liveClassroomRevocations").doc(jobId);
    expect((await job.get()).data()).toMatchObject({ state: "pending", attempts: 1 });
    expect(await dispatchClassroomRevocation(enrollment)).toMatchObject({ state: "completed", evicted: 1 });
    expect((await job.get()).get("attempts")).toBe(2);
  });

  it("does not disconnect a learner with a separate active paid or institutional entitlement", async () => {
    const otherId = "a".repeat(64);
    await firebaseAdminFirestore.collection("commerceEnrollments").doc(otherId).set({
      ...enrollment, enrollmentId: otherId, entitlementId: otherId,
      status: "active", accessEndsAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(await dispatchClassroomRevocation(enrollment)).toEqual({ state: "completed", evicted: 0 });
    expect(provider.removeParticipant).not.toHaveBeenCalled();
    const roster = await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName)
      .collection("authorized").doc(identity).get();
    expect(roster.get("bannedAt")).toBeUndefined();
  });

  it("does not disconnect a reactivated learner on delayed refund webhook retry", async () => {
    await firebaseAdminFirestore.collection("commerceEnrollments").doc(enrollment.enrollmentId)
      .update({ status: "active", updatedAt: new Date().toISOString() });
    expect(await dispatchClassroomRevocation(enrollment)).toEqual({ state: "superseded", evicted: 0 });
    expect((await firebaseAdminFirestore.collection("liveClassroomRevocations").doc(jobId).get())
      .get("state")).toBe("superseded");
    expect(provider.removeParticipant).not.toHaveBeenCalled();
  });

  it("refuses a new LUMA join token from a refunded enrollment before reaching the media service", async () => {
    const classroom = {
      offering: { tenantId: enrollment.tenantId, offeringId: enrollment.offeringId!,
        programId: "program", coachIds: [], title: "Course", status: "active" as const,
        cohortKey: "group-a", deliveryMode: "live" as const, timezone: "America/Guatemala",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      session: { sessionId, offeringId: enrollment.offeringId!, title: "Class",
        startsAt: new Date().toISOString(), durationMinutes: 90, status: "scheduled" as const,
        classroomProvider: "livekit" as const, recordingPolicy: "none" as const,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      roomName, identity, uid: enrollment.learnerId!,
      role: "learner" as const, displayName: "Learner", maxParticipants: 25,
    };
    vi.stubEnv("LUMA_LIVE_CLASSROOM_ENABLED", "true");
    vi.stubEnv("LIVEKIT_URL", "wss://dummy.livekit.cloud");
    vi.stubEnv("LIVEKIT_API_KEY", "LOCAL_TEST_KEY");
    vi.stubEnv("LIVEKIT_API_SECRET", "local-test-only-signing-secret-0123456789");
    try {
      await expect(createClassroomToken(classroom)).rejects.toMatchObject({
        reason: "classroom_access_revoked", status: 403,
      });
      // Even with a valid-looking provider configuration, no room can be created.
      expect(provider.createRoom).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("signed provider join fences an old token after access was revoked", async () => {
    expect(await disconnectIfClassroomAccessRevoked(roomName, identity)).toBe(true);
    expect(provider.removeParticipant).toHaveBeenCalledWith(roomName, identity, expect.anything());
    const roster = await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName)
      .collection("authorized").doc(identity).get();
    expect(roster.get("bannedAt")).toBeTruthy();
  });

  it("signed provider join preserves valid paid access", async () => {
    await firebaseAdminFirestore.collection("commerceEnrollments").doc(enrollment.enrollmentId)
      .update({ status: "active" });
    expect(await disconnectIfClassroomAccessRevoked(roomName, identity)).toBe(false);
    expect(provider.removeParticipant).not.toHaveBeenCalled();
  });

  it("refuses cross-room identity reuse and unknown participant without mutating provider", async () => {
    await expect(disconnectIfClassroomAccessRevoked("luma_bad", identity))
      .rejects.toThrow("CLASSROOM_WEBHOOK_ROOM_INVALID");
    const random = classroomParticipantId(roomName, "someone-else");
    expect(await disconnectIfClassroomAccessRevoked(roomName, random)).toBe(false);
    expect(provider.removeParticipant).not.toHaveBeenCalled();
  });
});
