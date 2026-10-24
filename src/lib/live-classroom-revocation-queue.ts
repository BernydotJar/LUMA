import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";

/** Enqueued in the SAME transaction that revokes paid/institutional access. */
export interface ClassroomRevocationIntent {
  enrollmentId: string;
  tenantId: string;
  offeringId: string;
  learnerId: string;
  sourceEventId: string;
  createdAt: string;
}

export function revocationJobId(input: Pick<ClassroomRevocationIntent,
  "enrollmentId" | "sourceEventId">): string {
  return createHash("sha256").update(JSON.stringify([
    input.enrollmentId, input.sourceEventId,
  ])).digest("hex");
}

export function enqueueClassroomRevocation(
  firestore: Firestore,
  tx: Transaction,
  input: ClassroomRevocationIntent,
): void {
  const { enrollmentId, tenantId, offeringId, learnerId, sourceEventId, createdAt } = input;
  if (![enrollmentId, tenantId, offeringId, learnerId, sourceEventId, createdAt]
    .every((value) => typeof value === "string" && value.trim().length > 0)) {
    throw new Error("CLASSROOM_REVOCATION_INVALID");
  }
  const id = revocationJobId(input);
  tx.create(firestore.collection("liveClassroomRevocations").doc(id), {
    jobId: id, enrollmentId, tenantId, offeringId, learnerId, sourceEventId,
    state: "pending", attempts: 0, createdAt, updatedAt: createdAt,
  });
}

/** Moderator expulsions are sticky; only a fresh legitimate re-grant may clear a commerce ban. */
export function mayRestoreRevokedLearnerAccess(input: {
  bannedAt?: string;
  banReason?: string;
}, activeGrantUpdatedAts: readonly string[]): boolean {
  const banTime = Date.parse(input.bannedAt ?? "");
  if (input.banReason !== "enrollment_revoked" || !Number.isFinite(banTime)) return false;
  return activeGrantUpdatedAts.some((timestamp) => {
    const refreshed = Date.parse(timestamp);
    return Number.isFinite(refreshed) && refreshed > banTime;
  });
}
