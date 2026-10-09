import { randomUUID } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import { describe, expect, it } from "vitest";
import { firebaseAdminFirestore } from "./firebase-admin";
import { recordClassroomPresence } from "./live-classroom-attendance";
import { classroomParticipantId, classroomRoomName } from "./live-classroom";
import { authorizeClassroom, ClassroomError, roomReference } from "./live-classroom-server";
import { programDeliveryStore } from "./program-delivery-server";

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

describe.runIf(emulatorEnabled)("LUMA classroom Firestore security and attendance", () => {
  it("deduplicates and reorders signed presence events for an authorized pseudonymous participant", async () => {
    const roomName = classroomRoomName("tenant-" + randomUUID(), "offering", "session");
    const identity = classroomParticipantId(roomName, "learner-1");
    const room = roomReference(roomName);
    await room.set({
      tenantId: "tenant", offeringId: "offering", sessionId: "session", programId: "program",
    });
    await room.collection("authorized").doc(identity).set({ uid: "learner-1", role: "learner" });

    // Provider delivery order deliberately differs from event-time order.
    const events = [
      { id: "EV_leave_2", type: "participant_left" as const, atSeconds: 1792500260 },
      { id: "EV_join_1", type: "participant_joined" as const, atSeconds: 1792500100 },
      { id: "EV_leave_1", type: "participant_left" as const, atSeconds: 1792500150 },
      { id: "EV_join_2", type: "participant_joined" as const, atSeconds: 1792500200 },
    ];
    for (const event of events) {
      await recordClassroomPresence({ ...event, roomName, identity });
    }
    await recordClassroomPresence({ ...events[0], roomName, identity });

    const record = (await room.collection("attendance").doc(identity).get()).data();
    expect(record?.uid).toBe("learner-1");
    expect(record?.connectionCount).toBe(2);
    expect(record?.attendedSeconds).toBe(110);
    expect(record?.connected).toBe(false);
    const recorded = await room.collection("attendance").doc(identity).collection("events").get();
    expect(recorded.size).toBe(4);

    // A signed event cannot manufacture a new LUMA enrollment or roster member.
    const unknown = classroomParticipantId(roomName, "not-enrolled");
    await recordClassroomPresence({
      roomName, identity: unknown, id: "EV_unregistered",
      type: "participant_joined", atSeconds: 1792500300,
    });
    expect((await room.collection("attendance").doc(unknown).get()).exists).toBe(false);
  });

  it("reads the exact tenant/cohort/session and denies revoked or mismatched enrollment", async () => {
    const suffix = randomUUID();
    const learnerId = `learner-${suffix}`;
    const offering = await programDeliveryStore.upsertOffering({
      tenantId: `classroom-tenant-${suffix}`,
      programId: `classroom-program-${suffix}`,
      cohortKey: "october",
      title: "Mastery",
      deliveryMode: "live",
      status: "active",
      timezone: "America/Bogota",
      coachIds: ["coach-" + suffix],
    });
    const session = await programDeliveryStore.scheduleSession(offering.offeringId, {
      sessionId: "s-" + suffix,
      title: "High ticket",
      startsAt: "2026-10-20T20:00:00Z",
      durationMinutes: 120,
      classroomProvider: "livekit",
      classroomCapacity: 120,
      recordingPolicy: "none",
    });
    const enrollmentId = "a".repeat(15) + suffix.replaceAll("-", "");
    const entitlement = firebaseAdminFirestore.collection("commerceEnrollments").doc(enrollmentId);
    await entitlement.set({
      enrollmentId,
      tenantId: offering.tenantId,
      programId: offering.programId,
      offeringId: offering.offeringId,
      productId: "product",
      customerId: "customer",
      learnerId,
      entitlementId: enrollmentId,
      status: "active",
      lastProvider: "hotmart",
      lastProviderEventId: "evt",
      lastEventAt: "2026-10-01T00:00:00Z",
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
    });
    const user = { uid: learnerId, email_verified: false } as DecodedIdToken;
    const atClass = new Date("2026-10-20T20:30:00Z");
    const admitted = await authorizeClassroom(user, offering.offeringId, session.sessionId, atClass);
    expect(admitted.role).toBe("learner");
    expect(admitted.maxParticipants).toBe(120);
    expect(admitted.roomName).toMatch(/^luma_[a-f0-9]{64}$/);

    await entitlement.update({ status: "revoked" });
    await expect(
      authorizeClassroom(user, offering.offeringId, session.sessionId, atClass),
    ).rejects.toMatchObject({ reason: "classroom_access_denied", status: 403 } satisfies Partial<ClassroomError>);

    await entitlement.update({ status: "active", tenantId: "wrong-tenant" });
    await expect(
      authorizeClassroom(user, offering.offeringId, session.sessionId, atClass),
    ).rejects.toMatchObject({ reason: "classroom_access_denied", status: 403 });

    // A completed class is no longer joinable even when commerce access remains valid.
    await entitlement.update({ tenantId: offering.tenantId });
    const ended = await programDeliveryStore.completeClassroomSession(
      offering.offeringId, session.sessionId, "2026-10-20T21:00:00Z",
    );
    expect(ended.status).toBe("completed");
    const replay = await programDeliveryStore.completeClassroomSession(
      offering.offeringId, session.sessionId, "2026-10-20T21:01:00Z",
    );
    expect(replay.status).toBe("completed");
    expect(replay.updatedAt).toBe("2026-10-20T21:00:00.000Z");
    await expect(
      authorizeClassroom(user, offering.offeringId, session.sessionId, atClass),
    ).rejects.toMatchObject({ reason: "classroom_closed", status: 409 });
  });
});
