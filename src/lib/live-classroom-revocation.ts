import { firebaseAdminFirestore } from "./firebase-admin";
import { commerceEnrollments } from "./commerce/server";
import { isActiveCommerceEnrollment, type CommerceEnrollmentRecord } from "./commerce/enrollment";
import { classroomParticipantId, classroomRoomName } from "./live-classroom";
import { ClassroomError, liveKitConfiguration, roomService, roomReference } from "./live-classroom-server";
import { revocationJobId, type ClassroomRevocationIntent } from "./live-classroom-revocation-queue";

const MAX_ROOMS_PER_ENROLLMENT = 100;
const LEASE_MS = 90_000;

type JobState = "pending" | "processing" | "completed" | "superseded";
type RevocationJob = ClassroomRevocationIntent & {
  jobId: string;
  state: JobState;
  attempts: number;
  leaseUntil?: string;
};

function supportsActiveAccess(enrollment: CommerceEnrollmentRecord, job: RevocationJob): boolean {
  return enrollment.learnerId === job.learnerId &&
    enrollment.tenantId === job.tenantId &&
    enrollment.offeringId === job.offeringId &&
    isActiveCommerceEnrollment(enrollment);
}

/**
 * Synchronous commerce/institutional delivery barrier: do not ACK a revocation
 * until connected LiveKit participants were removed, or there were none.
 * Job claims are durable and leased; retries can resume after worker failure.
 */
export async function dispatchClassroomRevocation(
  enrollment: CommerceEnrollmentRecord | undefined,
  sourceEventId?: string,
): Promise<{ state: "completed" | "not_applicable" | "superseded"; evicted: number }> {
  if (!enrollment || enrollment.status !== "revoked" ||
      !enrollment.learnerId || !enrollment.offeringId) {
    return { state: "not_applicable", evicted: 0 };
  }
  const id = revocationJobId({ enrollmentId: enrollment.enrollmentId,
    sourceEventId: sourceEventId ?? enrollment.lastProviderEventId });
  const jobRef = firebaseAdminFirestore.collection("liveClassroomRevocations").doc(id);
  const claimed = await firebaseAdminFirestore.runTransaction(async (tx) => {
    const doc = await tx.get(jobRef);
    if (!doc.exists) return null;
    const job = doc.data() as RevocationJob;
    if (job.jobId !== id || job.enrollmentId !== enrollment.enrollmentId ||
        job.tenantId !== enrollment.tenantId || job.offeringId !== enrollment.offeringId ||
        job.learnerId !== enrollment.learnerId) {
      throw new Error("CLASSROOM_REVOCATION_JOB_CONFLICT");
    }
    if (job.state === "completed" || job.state === "superseded") return job;
    if (job.state === "processing" && Date.parse(job.leaseUntil ?? "") > Date.now()) {
      throw new Error("CLASSROOM_REVOCATION_IN_PROGRESS");
    }
    tx.update(jobRef, {
      state: "processing", attempts: (job.attempts ?? 0) + 1,
      leaseUntil: new Date(Date.now() + LEASE_MS).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { ...job, state: "processing" as const };
  });
  if (!claimed) {
    // A previously migrated/persisted refund without its associated outbox
    // cannot be mistaken for a verified media disconnection.
    throw new Error("CLASSROOM_REVOCATION_JOB_MISSING");
  }
  if (claimed.state === "completed" || claimed.state === "superseded") {
    return { state: claimed.state === "superseded" ? "superseded" : "completed", evicted: 0 };
  }
  try {
    const latest = await firebaseAdminFirestore.collection("commerceEnrollments")
      .doc(claimed.enrollmentId).get();
    const latestEnrollment = latest.exists ? latest.data() as CommerceEnrollmentRecord : undefined;
    if (!latestEnrollment || latestEnrollment.status !== "revoked" ||
        latestEnrollment.tenantId !== claimed.tenantId ||
        latestEnrollment.offeringId !== claimed.offeringId ||
        latestEnrollment.learnerId !== claimed.learnerId) {
      await jobRef.update({ state: "superseded", leaseUntil: null,
        reason: "enrollment_active_or_changed", updatedAt: new Date().toISOString() });
      return { state: "superseded", evicted: 0 };
    }
    const enrollments = await commerceEnrollments.listByLearner(claimed.learnerId);
    if (enrollments.some((current) => supportsActiveAccess(current, claimed))) {
      await jobRef.update({ state: "completed", leaseUntil: null,
        reason: "another_valid_enrollment", evicted: 0, updatedAt: new Date().toISOString() });
      return { state: "completed", evicted: 0 };
    }

    const snapshot = await firebaseAdminFirestore.collection("liveClassroomRooms")
      .where("offeringId", "==", claimed.offeringId)
      .limit(MAX_ROOMS_PER_ENROLLMENT + 1).get();
    if (snapshot.size > MAX_ROOMS_PER_ENROLLMENT) {
      throw new Error("CLASSROOM_REVOCATION_SCAN_LIMIT");
    }
    const matches: Array<{ roomName: string; identity: string }> = [];
    for (const roomDoc of snapshot.docs) {
      const room = roomDoc.data();
      if (room.tenantId !== claimed.tenantId || room.offeringId !== claimed.offeringId ||
          typeof room.sessionId !== "string" ||
          roomDoc.id !== classroomRoomName(claimed.tenantId, claimed.offeringId, room.sessionId)) continue;
      const identity = classroomParticipantId(roomDoc.id, claimed.learnerId);
      const roster = await roomReference(roomDoc.id).collection("authorized").doc(identity).get();
      if (roster.exists && roster.get("uid") === claimed.learnerId &&
          roster.get("role") === "learner") matches.push({ roomName: roomDoc.id, identity });
    }

    let evicted = 0;
    if (matches.length) {
      // Never mark a provider removal as successful merely because Firestore access is revoked.
      const service = roomService(liveKitConfiguration());
      for (const { roomName, identity } of matches) {
        const rosterRef = roomReference(roomName).collection("authorized").doc(identity);
        await firebaseAdminFirestore.runTransaction(async (tx) => {
          const currentRoster = await tx.get(rosterRef);
          if (!currentRoster.exists || currentRoster.get("uid") !== claimed.learnerId ||
              currentRoster.get("role") !== "learner") {
            throw new Error("CLASSROOM_REVOCATION_ROSTER_CHANGED");
          }
          // An instructor's earlier removal is permanent and not auto-cleared
          // by a later paid reactivation; never relabel a moderation ban.
          if (!currentRoster.get("bannedAt")) {
            tx.set(rosterRef, {
              bannedAt: new Date().toISOString(),
              banReason: "enrollment_revoked", revocationJobId: claimed.jobId,
            }, { merge: true });
          }
        });
        // A valid reactivation or replacement enrollment may have committed
        // while we enumerated rooms. Re-check directly before each eviction;
        // no stale refund is allowed to justify kicking a newly paid learner.
        const mostRecent = await firebaseAdminFirestore.collection("commerceEnrollments")
          .doc(claimed.enrollmentId).get();
        const mostRecentData = mostRecent.exists
          ? mostRecent.data() as CommerceEnrollmentRecord : undefined;
        const grants = await commerceEnrollments.listByLearner(claimed.learnerId);
        if (!mostRecentData || mostRecentData.status !== "revoked" ||
            mostRecentData.tenantId !== claimed.tenantId ||
            mostRecentData.offeringId !== claimed.offeringId ||
            mostRecentData.learnerId !== claimed.learnerId ||
            grants.some((record) => supportsActiveAccess(record, claimed))) {
          await jobRef.update({ state: "superseded", leaseUntil: null,
            reason: "entitlement_changed_before_media_remove", updatedAt: new Date().toISOString() });
          return { state: "superseded", evicted };
        }
        try {
          await service.removeParticipant(roomName, identity, {
            revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
          });
          evicted += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // The member is already disconnected; the signed join webhook guards
          // a subsequent join with any previously issued, still valid JWT.
          if (/participant.*not found|room.*not found|does not exist|not_found/i.test(message)) {
            continue;
          }
          throw error;
        }
      }
    }
    await jobRef.update({ state: "completed", leaseUntil: null,
      evicted, rosterMatches: matches.length, updatedAt: new Date().toISOString() });
    return { state: "completed", evicted };
  } catch (error) {
    await jobRef.update({ state: "pending", leaseUntil: null,
      lastErrorCode: error instanceof ClassroomError ? error.reason : "provider_or_storage_unavailable",
      updatedAt: new Date().toISOString(),
    }).catch(() => {});
    throw new Error("CLASSROOM_REVOCATION_RETRYABLE", { cause: error });
  }
}

/** Fences a previously issued join token after a paid/institutional refund. */
export async function disconnectIfClassroomAccessRevoked(
  roomName: string,
  identity: string,
): Promise<boolean> {
  if (!/^luma_[a-f0-9]{64}$/.test(roomName) || !/^p_[a-f0-9]{64}$/.test(identity)) {
    throw new Error("CLASSROOM_WEBHOOK_ROOM_INVALID");
  }
  const roomRef = roomReference(roomName);
  const [room, roster] = await Promise.all([
    roomRef.get(), roomRef.collection("authorized").doc(identity).get(),
  ]);
  if (!room.exists || !roster.exists) return false;
  const data = room.data();
  if (!data || typeof data.tenantId !== "string" ||
      typeof data.offeringId !== "string" || typeof data.sessionId !== "string" ||
      roomName !== classroomRoomName(data.tenantId, data.offeringId, data.sessionId)) {
    throw new Error("CLASSROOM_WEBHOOK_ROOM_MISMATCH");
  }
  if (roster.get("role") !== "learner") return false;
  const uid = roster.get("uid");
  if (typeof uid !== "string" || identity !== classroomParticipantId(roomName, uid)) {
    throw new Error("CLASSROOM_WEBHOOK_ROSTER_MISMATCH");
  }
  const enrollments = await commerceEnrollments.listByLearner(uid);
  const eligible = enrollments.some((record) =>
    record.tenantId === data.tenantId && record.offeringId === data.offeringId &&
    isActiveCommerceEnrollment(record));
  if (eligible && !roster.get("bannedAt")) return false;
  if (!roster.get("bannedAt")) {
    await roster.ref.set({ bannedAt: new Date().toISOString(),
      banReason: "enrollment_revoked" }, { merge: true });
  }
  try {
    await roomService(liveKitConfiguration()).removeParticipant(roomName, identity, {
      revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/participant.*not found|room.*not found|does not exist|not_found/i.test(message)) throw error;
  }
  return true;
}
