import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { firebaseAdminFirestore } from "./firebase-admin";
import { classroomParticipantId, classroomRoomName } from "./live-classroom";
import { classroomExpiryEventId, runClassroomMaintenance } from "./live-classroom-maintenance-server";
import { revocationJobId } from "./live-classroom-revocation-queue";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";

const provider = vi.hoisted(() => ({ removeParticipant: vi.fn() }));
vi.mock("./live-classroom-server", async (importOriginal) => {
  const current = await importOriginal<typeof import("./live-classroom-server")>();
  return {
    ...current,
    liveKitConfiguration: () => ({
      serverUrl: "wss://test.livekit.cloud", httpUrl: "https://test.livekit.cloud",
      apiKey: "TEST_KEY", apiSecret: "test-only-identity-secret-not-for-deploy",
    }),
    roomService: () => ({ removeParticipant: provider.removeParticipant }),
  };
});

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.runIf(emulator)("OIDC-maintained classroom expiry / disconnect worker", () => {
  let enrollment: CommerceEnrollmentRecord;
  let roomName: string;
  let identity: string;
  let startTime: Date;
  let jobId: string;

  beforeEach(async () => {
    provider.removeParticipant.mockReset();
    provider.removeParticipant.mockResolvedValue(undefined);
    const uuid = randomUUID();
    startTime = new Date(Date.now());
    const tenantId = "tenant-" + uuid;
    const offeringId = "offering-" + uuid;
    const learnerId = "learner-" + uuid;
    const sessionId = "session-" + uuid;
    const enrollmentId = createHash("sha256").update(uuid).digest("hex");
    const ends = new Date(startTime.getTime() - 8_000).toISOString();
    roomName = classroomRoomName(tenantId, offeringId, sessionId);
    identity = classroomParticipantId(roomName, learnerId);
    enrollment = {
      enrollmentId, entitlementId: enrollmentId, tenantId, offeringId, learnerId,
      programId: "live-program", productId: "course", customerId: "client",
      status: "active", enrollmentSource: "commerce", accessEndsAt: ends,
      lastProvider: "stripe", lastProviderEventId: "purchase-" + uuid,
      lastEventAt: new Date(startTime.getTime() - 60_000).toISOString(),
      createdAt: new Date(startTime.getTime() - 60_000).toISOString(),
      updatedAt: new Date(startTime.getTime() - 60_000).toISOString(),
    };
    jobId = revocationJobId({
      enrollmentId, sourceEventId: classroomExpiryEventId(ends),
    });
    await firebaseAdminFirestore.collection("commerceEnrollments").doc(enrollmentId)
      .set(enrollment);
    await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName)
      .set({ tenantId, offeringId, sessionId, createdAt: new Date().toISOString() });
    await firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName)
      .collection("authorized").doc(identity)
      .set({ uid: learnerId, role: "learner" });
  });

  it("expires a scheduled entitlement, atomically queues removal and disconnects an active learner", async () => {
    const result = await runClassroomMaintenance(startTime);
    expect(result.state).toBe("completed");
    const changed = await firebaseAdminFirestore.collection("commerceEnrollments")
      .doc(enrollment.enrollmentId).get();
    expect(changed.get("status")).toBe("revoked");
    expect(changed.get("lastProviderEventId")).toBe(enrollment.lastProviderEventId);
    const job = await firebaseAdminFirestore.collection("liveClassroomRevocations")
      .doc(jobId).get();
    expect(job.data()).toMatchObject({
      state: "completed", enrollmentId: enrollment.enrollmentId, evicted: 1,
    });
    expect(provider.removeParticipant).toHaveBeenCalledWith(
      roomName, identity, expect.objectContaining({ revokeTokenTs: expect.any(BigInt) }),
    );
    const roster = await firebaseAdminFirestore.collection("liveClassroomRooms")
      .doc(roomName).collection("authorized").doc(identity).get();
    expect(roster.get("bannedAt")).toBeTruthy();
    expect(roster.get("banReason")).toBe("enrollment_revoked");
  });

  it("retains a failed vendor eviction and retries it after the next Scheduler invocation", async () => {
    provider.removeParticipant.mockRejectedValueOnce(new Error("media service temporarily unavailable"));
    const first = await runClassroomMaintenance(startTime);
    const doc = firebaseAdminFirestore.collection("liveClassroomRevocations").doc(jobId);
    expect((await doc.get()).get("state")).toBe("pending");
    expect(first.retryableFailures).toBeGreaterThan(0);
    const second = await runClassroomMaintenance(new Date(startTime.getTime() + 65_000));
    expect(second.state).toBe("completed");
    expect((await doc.get()).data()).toMatchObject({ state: "completed", attempts: 2 });
    expect(provider.removeParticipant).toHaveBeenCalledWith(
      roomName, identity, expect.anything(),
    );
  });

  it("does not start a parallel sweep while another Scheduler lease is active", async () => {
    const lease = firebaseAdminFirestore.collection("liveClassroomMaintenance").doc("reconciler");
    await lease.set({
      leaseId: "other-worker",
      leaseUntil: new Date(startTime.getTime() + 65_000).toISOString(),
    });
    const result = await runClassroomMaintenance(startTime);
    expect(result.state).toBe("already_running");
    expect(result.expiredEnrollments).toBe(0);
    expect(provider.removeParticipant).not.toHaveBeenCalled();
    expect((await firebaseAdminFirestore.collection("commerceEnrollments")
      .doc(enrollment.enrollmentId).get()).get("status")).toBe("active");
    await lease.delete();
  });

  it("returns partial_failure when an unrelated damaged outbox needs repair", async () => {
    const queue = firebaseAdminFirestore.collection("liveClassroomRevocations");
    const invalidRef = queue.doc(createHash("sha256").update(randomUUID()).digest("hex"));
    await invalidRef.set({
      enrollmentId: "malformed",
      sourceEventId: "bad",
      state: "pending",
      updatedAt: new Date(startTime.getTime() - 10_000).toISOString(),
    });
    const result = await runClassroomMaintenance(startTime);
    expect(result.state).toBe("partial_failure");
    expect(result.retryableFailures).toBeGreaterThan(0);
    expect((await invalidRef.get()).get("state")).toBe("pending");
    await invalidRef.delete();
  });

  it("never expires a future entitlement, even when processing other due records", async () => {
    await firebaseAdminFirestore.collection("commerceEnrollments")
      .doc(enrollment.enrollmentId)
      .update({ accessEndsAt: new Date(startTime.getTime() + 60 * 60_000).toISOString() });
    await runClassroomMaintenance(startTime);
    expect((await firebaseAdminFirestore.collection("commerceEnrollments")
      .doc(enrollment.enrollmentId).get()).get("status")).toBe("active");
    expect((await firebaseAdminFirestore.collection("liveClassroomRevocations")
      .doc(jobId).get()).exists).toBe(false);
    expect(provider.removeParticipant).not.toHaveBeenCalledWith(
      roomName, identity, expect.anything(),
    );
  });
});
