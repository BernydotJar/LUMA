import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { validLearningScopeId, type LearningScope } from "@/lib/learning-entitlement";
import {
  methodDigest, validTeachingTwinMethod,
  type TeachingTwinMethod, type TeachingTwinRevision,
} from "./contracts";

function sha(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * An independent tenant AND program path. Neither an LLM-generated scope
 * nor a browser-supplied tenant ID is authority to open this collection.
 */
export class TeachingTwinStore {
  constructor(private readonly firestore: Firestore) {}

  private document(scope: LearningScope) {
    if (!validLearningScopeId(scope.tenantId) ||
        !validLearningScopeId(scope.programId)) {
      throw new Error("TWIN_STORE_INVALID_SCOPE");
    }
    return this.firestore.collection("learningTenants").doc(sha(scope.tenantId))
      .collection("learningPrograms").doc(sha(scope.programId))
      .collection("pilotTeachingTwin").doc("config");
  }

  async readDraft(scope: LearningScope): Promise<TeachingTwinRevision | undefined> {
    const snap = await this.document(scope).get();
    if (!snap.exists) return undefined;
    const data = snap.data() as TeachingTwinRevision;
    if (data.tenantId !== scope.tenantId || data.programId !== scope.programId) {
      throw new Error("TWIN_STORE_CORRUPT_SCOPE");
    }
    return data;
  }

  async readApproved(scope: LearningScope): Promise<TeachingTwinRevision | undefined> {
    const snap = await this.document(scope).collection("releases").doc("approved").get();
    if (!snap.exists) return undefined;
    const data = snap.data() as TeachingTwinRevision;
    if (data.tenantId !== scope.tenantId || data.programId !== scope.programId ||
        data.status !== "APPROVED" ||
        data.approvedByUid !== data.teacherUid ||
        typeof data.approvedAt !== "string" ||
        !Number.isFinite(Date.parse(data.approvedAt)) ||
        !validTeachingTwinMethod(data.method) ||
        data.methodSha256 !== methodDigest(data.method)) {
      throw new Error("TWIN_STORE_UNTRUSTED_APPROVAL");
    }
    return data;
  }

  /**
   * Compare-and-swap revision; there is no approval from simply writing a
   * draft. No teacher-supplied revision, identity, timestamp or scope.
   */
  async saveDraft(
    scope: LearningScope,
    teacherUid: string,
    method: TeachingTwinMethod,
    expectedRevision: number,
  ): Promise<TeachingTwinRevision> {
    if (!teacherUid || !validTeachingTwinMethod(method) ||
        !Number.isInteger(expectedRevision) || expectedRevision < 0) {
      throw new Error("TWIN_DRAFT_INVALID");
    }
    const ref = this.document(scope);
    return this.firestore.runTransaction(async (tx) => {
      const currentSnap = await tx.get(ref);
      const current = currentSnap.exists ? currentSnap.data() as TeachingTwinRevision : undefined;
      if ((current?.revision ?? 0) !== expectedRevision) {
        throw new Error("TWIN_DRAFT_REVISION_CONFLICT");
      }
      if (current && (current.teacherUid !== teacherUid ||
          current.tenantId !== scope.tenantId ||
          current.programId !== scope.programId)) {
        throw new Error("TWIN_DRAFT_TEACHER_OR_SCOPE_MISMATCH");
      }
      const revision = expectedRevision + 1;
      const next: TeachingTwinRevision = {
        schemaVersion: 1,
        revision,
        tenantId: scope.tenantId,
        programId: scope.programId,
        teacherUid,
        method,
        methodSha256: methodDigest(method),
        status: "DRAFT",
        createdAt: new Date().toISOString(),
      };
      const history = ref.collection("history").doc(`draft-${revision}`);
      tx.create(history, next);
      tx.set(ref, next);
      return next;
    });
  }

  /** Authorised instructor approval; no model or automation can call this. */
  async approve(
    scope: LearningScope, teacherUid: string, expectedRevision: number,
  ): Promise<TeachingTwinRevision> {
    if (!teacherUid || !Number.isInteger(expectedRevision) || expectedRevision < 1) {
      throw new Error("TWIN_APPROVAL_INVALID");
    }
    const ref = this.document(scope);
    const release = ref.collection("releases").doc("approved");
    const receipt = ref.collection("history").doc(`approval-${expectedRevision}`);
    return this.firestore.runTransaction(async (tx) => {
      const [draftSnap, releasedSnap] = await Promise.all([tx.get(ref), tx.get(release)]);
      if (!draftSnap.exists) throw new Error("TWIN_DRAFT_NOT_FOUND");
      const draft = draftSnap.data() as TeachingTwinRevision;
      if (draft.revision !== expectedRevision ||
          draft.teacherUid !== teacherUid ||
          draft.tenantId !== scope.tenantId ||
          draft.programId !== scope.programId ||
          !validTeachingTwinMethod(draft.method) ||
          draft.methodSha256 !== methodDigest(draft.method)) {
        throw new Error("TWIN_APPROVAL_STALE_OR_UNTRUSTED");
      }
      const previouslyApproved = releasedSnap.exists ?
        releasedSnap.data() as TeachingTwinRevision : undefined;
      if (previouslyApproved?.revision === expectedRevision) {
        if (previouslyApproved.methodSha256 !== draft.methodSha256) {
          throw new Error("TWIN_APPROVAL_CONFLICT");
        }
        return previouslyApproved;
      }
      const next: TeachingTwinRevision = {
        ...draft,
        status: "APPROVED",
        approvedByUid: teacherUid,
        approvedAt: new Date().toISOString(),
      };
      tx.create(receipt, next);
      tx.set(release, next);
      return next;
    });
  }
}
