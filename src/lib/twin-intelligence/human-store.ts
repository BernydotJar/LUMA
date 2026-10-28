import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { validLearningScopeId, type LearningScope } from "@/lib/learning-entitlement";

export interface HumanIntervention {
  schemaVersion: 1;
  interventionId: string;
  revision: number;
  tenantId: string;
  programId: string;
  learnerId: string;
  teacherUid: string;
  reasonEventId: string;
  status: "OPEN" | "COMPLETED" | "DISMISSED";
  openedAt: string;
  respondedAt?: string;
  followUpEventId?: string;
}

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const validId = (s: string) => /^[A-Za-z0-9._:-]{1,128}$/.test(s);

/**
 * Human interventions are separate from the Learning Twin. Recording a
 * follow-up cannot directly change the learner's mastery projection.
 */
export class HumanInterventionStore {
  constructor(private readonly firestore: Firestore) {}

  private collection(scope: LearningScope) {
    if (!validLearningScopeId(scope.tenantId) ||
        !validLearningScopeId(scope.programId)) {
      throw new Error("TWIN_INTERVENTION_SCOPE_INVALID");
    }
    return this.firestore.collection("learningTenants").doc(hash(scope.tenantId))
      .collection("learningPrograms").doc(hash(scope.programId))
      .collection("pilotHumanInterventions");
  }

  private document(scope: LearningScope, learnerId: string, idempotencyKey: string) {
    if (!validId(learnerId) || !validId(idempotencyKey)) {
      throw new Error("TWIN_INTERVENTION_INPUT_INVALID");
    }
    return this.collection(scope).doc(hash(`${learnerId}:${idempotencyKey}`));
  }

  async open(
    scope: LearningScope, teacherUid: string,
    learnerId: string, reasonEventId: string, idempotencyKey: string,
  ): Promise<HumanIntervention> {
    if (!validId(teacherUid) || !validId(reasonEventId)) {
      throw new Error("TWIN_INTERVENTION_INPUT_INVALID");
    }
    const ref = this.document(scope, learnerId, idempotencyKey);
    return this.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const existing = snap.data() as HumanIntervention;
        if (existing.teacherUid !== teacherUid ||
            existing.learnerId !== learnerId ||
            existing.tenantId !== scope.tenantId ||
            existing.programId !== scope.programId ||
            existing.reasonEventId !== reasonEventId) {
          throw new Error("TWIN_INTERVENTION_IDEMPOTENCY_CONFLICT");
        }
        return existing;
      }
      const record: HumanIntervention = {
        schemaVersion: 1, interventionId: ref.id, revision: 1,
        tenantId: scope.tenantId, programId: scope.programId,
        learnerId, teacherUid, reasonEventId, status: "OPEN",
        openedAt: new Date().toISOString(),
      };
      tx.create(ref, record);
      tx.create(ref.collection("history").doc("event-1"), {
        type: "OPENED", teacherUid, reasonEventId, occurredAt: record.openedAt,
      });
      return record;
    });
  }

  async close(
    scope: LearningScope, teacherUid: string, learnerId: string,
    interventionId: string, expectedRevision: number,
    outcome: "COMPLETED" | "DISMISSED", followUpEventId?: string,
    verifiedFollowUpRecordedAt?: string,
  ): Promise<HumanIntervention> {
    if (!validId(teacherUid) || !validId(learnerId) ||
        !/^[a-f0-9]{64}$/.test(interventionId) ||
        !Number.isInteger(expectedRevision) || expectedRevision !== 1 ||
        (outcome === "COMPLETED" && (!followUpEventId || !validId(followUpEventId) ||
          !verifiedFollowUpRecordedAt ||
          !Number.isFinite(Date.parse(verifiedFollowUpRecordedAt)))) ||
        (outcome === "DISMISSED" && followUpEventId)) {
      throw new Error("TWIN_INTERVENTION_INPUT_INVALID");
    }
    const ref = this.collection(scope).doc(interventionId);
    return this.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("TWIN_INTERVENTION_NOT_FOUND");
      const current = snap.data() as HumanIntervention;
      if (current.teacherUid !== teacherUid ||
          current.learnerId !== learnerId ||
          current.tenantId !== scope.tenantId ||
          current.programId !== scope.programId) {
        throw new Error("TWIN_INTERVENTION_SCOPE_FORBIDDEN");
      }
      if (current.status !== "OPEN") {
        if (current.status === outcome && current.followUpEventId === followUpEventId) {
          return current;
        }
        throw new Error("TWIN_INTERVENTION_ALREADY_CLOSED");
      }
      if (outcome === "COMPLETED" &&
          (followUpEventId === current.reasonEventId ||
           Date.parse(verifiedFollowUpRecordedAt!) <= Date.parse(current.openedAt))) {
        throw new Error("TWIN_INTERVENTION_FOLLOWUP_NOT_LATER");
      }
      if (current.revision !== expectedRevision) {
        throw new Error("TWIN_INTERVENTION_REVISION_CONFLICT");
      }
      const respondedAt = new Date().toISOString();
      const next: HumanIntervention = {
        ...current, status: outcome, revision: 2, respondedAt,
        ...(followUpEventId ? { followUpEventId } : {}),
      };
      tx.create(ref.collection("history").doc("event-2"), {
        type: outcome, teacherUid, followUpEventId: followUpEventId ?? null,
        occurredAt: respondedAt,
      });
      tx.set(ref, next);
      return next;
    });
  }

  async listByTeacher(
    scope: LearningScope, teacherUid: string, limit = 20,
  ): Promise<HumanIntervention[]> {
    if (!validId(teacherUid)) throw new Error("TWIN_INTERVENTION_INPUT_INVALID");
    const snap = await this.collection(scope).where("teacherUid", "==", teacherUid)
      .limit(Math.min(20, Math.max(1, Math.trunc(limit)))).get();
    return snap.docs.map((doc) => doc.data() as HumanIntervention).filter((v) =>
      v.tenantId === scope.tenantId && v.programId === scope.programId &&
      v.teacherUid === teacherUid);
  }
}
