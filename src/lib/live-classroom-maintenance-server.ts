import { randomUUID } from "node:crypto";
import { firebaseAdminFirestore } from "./firebase-admin";
import { enqueueClassroomRevocation, revocationJobId } from "./live-classroom-revocation-queue";
import { dispatchClassroomRevocation } from "./live-classroom-revocation";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";

const MAX_DUE_ENROLLMENTS = 25;
const MAX_DUE_JOBS = 25;
const MAX_JOB_SCAN = 100;
// Longer than the 90-second Scheduler request deadline to avoid overlapping runs
// when Cloud Run is still processing after a caller has timed out.
const LEASE_MILLISECONDS = 120_000;
const RUN_TIME_BUDGET_MS = 75_000;

export type ClassroomMaintenanceResult = {
  state: "completed" | "partial_failure" | "already_running";
  checkedAt: string;
  expiredEnrollments: number;
  queuedDisconnects: number;
  processedDisconnects: number;
  removedParticipants: number;
  retryableFailures: number;
  limitReached: boolean;
};

type StoredRevocationJob = {
  enrollmentId: string;
  sourceEventId: string;
  state: string;
  leaseUntil?: string;
  updatedAt?: string;
};

export function classroomExpiryEventId(isoExpiry: string): string {
  const when = Date.parse(isoExpiry);
  if (!Number.isFinite(when)) throw new Error("CLASSROOM_EXPIRY_INVALID");
  return "system.expiry:" + new Date(when).toISOString();
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

/** Transactionally expire one enrollment and create its disconnect outbox. */
async function expireOneEnrollment(
  enrollmentId: string,
  nowISO: string,
): Promise<{ expired: boolean; queued: boolean }> {
  const docRef = firebaseAdminFirestore.collection("commerceEnrollments").doc(enrollmentId);
  return firebaseAdminFirestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(docRef);
    if (!snapshot.exists) return { expired: false, queued: false };
    const record = snapshot.data() as CommerceEnrollmentRecord;
    if (record.status !== "active" || !record.accessEndsAt ||
        !validTimestamp(record.accessEndsAt) ||
        Date.parse(record.accessEndsAt) > Date.parse(nowISO)) {
      return { expired: false, queued: false };
    }
    const eventId = classroomExpiryEventId(record.accessEndsAt);
    const queueNeeded = Boolean(record.learnerId && record.offeringId);
    const jobRef = firebaseAdminFirestore.collection("liveClassroomRevocations")
      .doc(revocationJobId({ enrollmentId, sourceEventId: eventId }));
    // All Firestore transaction reads precede all writes.
    const existingJob = queueNeeded ? await tx.get(jobRef) : undefined;
    tx.update(docRef, { status: "revoked", updatedAt: nowISO,
      expirationProcessedAt: nowISO });
    if (queueNeeded && !existingJob?.exists) {
      enqueueClassroomRevocation(firebaseAdminFirestore, tx, {
        enrollmentId,
        tenantId: record.tenantId,
        offeringId: record.offeringId!,
        learnerId: record.learnerId!,
        sourceEventId: eventId,
        createdAt: nowISO,
      });
    }
    return { expired: true, queued: queueNeeded };
  });
}

/**
 * Internal, bounded housekeeping execution: never scan the whole user base.
 * A Firestore lease prevents overlapping Scheduler invocations and a durable
 * outbox keeps vendor failures retryable after the scheduler call has ended.
 */
export async function runClassroomMaintenance(
  now: Date = new Date(),
): Promise<ClassroomMaintenanceResult> {
  if (!Number.isFinite(now.getTime())) throw new Error("CLASSROOM_MAINTENANCE_TIME_INVALID");
  const nowISO = now.toISOString();
  const startedMonotonicAt = performance.now();
  const withinBudget = () => performance.now() - startedMonotonicAt < RUN_TIME_BUDGET_MS;
  const leaseRef = firebaseAdminFirestore.collection("liveClassroomMaintenance").doc("reconciler");
  const leaseId = randomUUID();
  const acquired = await firebaseAdminFirestore.runTransaction(async (tx) => {
    const current = await tx.get(leaseRef);
    if (current.exists && validTimestamp(current.get("leaseUntil") ?? "") &&
        Date.parse(current.get("leaseUntil")) > now.getTime()) return false;
    tx.set(leaseRef, {
      leaseId,
      leaseUntil: new Date(now.getTime() + LEASE_MILLISECONDS).toISOString(),
      startedAt: nowISO,
    }, { merge: true });
    return true;
  });
  const totals: ClassroomMaintenanceResult = {
    state: acquired ? "completed" : "already_running",
    checkedAt: nowISO,
    expiredEnrollments: 0,
    queuedDisconnects: 0,
    processedDisconnects: 0,
    removedParticipants: 0,
    retryableFailures: 0,
    limitReached: false,
  };
  if (!acquired) return totals;

  try {
    const due = await firebaseAdminFirestore.collection("commerceEnrollments")
      .where("status", "==", "active")
      .where("accessEndsAt", "<=", nowISO)
      .orderBy("accessEndsAt", "asc")
      .limit(MAX_DUE_ENROLLMENTS + 1).get();
    totals.limitReached ||= due.size > MAX_DUE_ENROLLMENTS;
    for (const doc of due.docs.slice(0, MAX_DUE_ENROLLMENTS)) {
      if (!withinBudget()) { totals.limitReached = true; break; }
      try {
        const { expired, queued } = await expireOneEnrollment(doc.id, nowISO);
        if (expired) totals.expiredEnrollments += 1;
        if (queued) totals.queuedDisconnects += 1;
      } catch {
        // Never mark the run healthy if any enrollment state transition failed.
        totals.retryableFailures += 1;
      }
    }

    const queue = firebaseAdminFirestore.collection("liveClassroomRevocations");
    const [pending, stalled] = await Promise.all([
      queue.where("state", "==", "pending").orderBy("updatedAt", "asc")
        .limit(MAX_JOB_SCAN).get(),
      queue.where("state", "==", "processing").where("leaseUntil", "<=", nowISO)
        .orderBy("leaseUntil", "asc").limit(MAX_JOB_SCAN).get(),
    ]);
    const available = [...pending.docs, ...stalled.docs]
      .sort((a, b) => String(a.get("updatedAt") ?? "").localeCompare(
        String(b.get("updatedAt") ?? "")));
    totals.limitReached ||= available.length > MAX_DUE_JOBS ||
      pending.size >= MAX_JOB_SCAN || stalled.size >= MAX_JOB_SCAN;

    for (const doc of available.slice(0, MAX_DUE_JOBS)) {
      if (!withinBudget()) { totals.limitReached = true; break; }
      const job = doc.data() as StoredRevocationJob;
      if (!/^[a-f0-9]{64}$/.test(job.enrollmentId) ||
          typeof job.sourceEventId !== "string" || !job.sourceEventId ||
          !["pending", "processing"].includes(job.state)) {
        totals.retryableFailures += 1;
        continue;
      }
      try {
        const enrollment = await firebaseAdminFirestore.collection("commerceEnrollments")
          .doc(job.enrollmentId).get();
        if (!enrollment.exists) {
          totals.retryableFailures += 1;
          continue;
        }
        const result = await dispatchClassroomRevocation(
          enrollment.data() as CommerceEnrollmentRecord,
          job.sourceEventId,
        );
        if (result.state !== "not_applicable") {
          totals.processedDisconnects += 1;
          totals.removedParticipants += result.evicted;
        } else {
          totals.retryableFailures += 1;
        }
      } catch {
        totals.retryableFailures += 1;
      }
    }
    if (totals.retryableFailures || totals.limitReached) totals.state = "partial_failure";
    return totals;
  } finally {
    // A crashed invocation remains protected by the expiring lease.
    // A delayed old worker must not release another worker's lease.
    await firebaseAdminFirestore.runTransaction(async (tx) => {
      const current = await tx.get(leaseRef);
      if (current.get("leaseId") === leaseId) {
        tx.set(leaseRef, {
          leaseUntil: nowISO,
          finishedAt: new Date().toISOString(),
          summary: totals,
        }, { merge: true });
      }
    });
  }
}
