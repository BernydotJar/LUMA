import { createHash, randomUUID } from "node:crypto";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import type { CommerceEnrollmentRecord } from "./enrollment";
import type { ProgramOffering } from "@/lib/program-delivery";
import {
  enrollmentIdForGrant,
  parseInstitutionalGrant,
  parseInstitutionalRevocationReason,
  type InstitutionalGrantRequest,
} from "./institutional-grants";

export interface InstitutionalEnrollmentRecord extends CommerceEnrollmentRecord {
  enrollmentSource: "institutional";
  institutionalApprovedBy: string;
  institutionalApprovedAt: string;
  institutionalReason: string;
  institutionalRevision: number;
  institutionalRevokedAt?: string;
  institutionalRevokedBy?: string;
  institutionalRevocationReason?: string;
}

function assertOffering(offering: ProgramOffering | undefined, grant: InstitutionalGrantRequest) {
  if (!offering ||
      offering.tenantId !== grant.tenantId ||
      offering.programId !== grant.programId ||
      offering.offeringId !== grant.offeringId ||
      offering.status !== "active") {
    throw new Error("INSTITUTIONAL_OFFERING_NOT_ACTIVE");
  }
}

export class FirestoreInstitutionalGrantStore {
  constructor(private readonly firestore: Firestore) {}

  async grant(input: unknown, actorUid: string) {
    const grant = parseInstitutionalGrant(input);
    const id = enrollmentIdForGrant(grant);
    const ref = this.firestore.collection("commerceEnrollments").doc(id);
    const offeringRef = this.firestore.collection("programOfferings").doc(grant.offeringId);
    const now = new Date().toISOString();

    return this.firestore.runTransaction(async tx => {
      // Authorization is performed in the API and business identity validated
      // against the current offering within this same transaction.
      const [offeringDoc, existingDoc] = await Promise.all([
        tx.get(offeringRef), tx.get(ref),
      ]);
      assertOffering(offeringDoc.exists ? offeringDoc.data() as ProgramOffering : undefined, grant);
      const existing = existingDoc.exists
        ? existingDoc.data() as InstitutionalEnrollmentRecord : undefined;
      if (existing && (
        existing.enrollmentSource !== "institutional" ||
        existing.tenantId !== grant.tenantId ||
        existing.programId !== grant.programId ||
        existing.offeringId !== grant.offeringId ||
        existing.email !== grant.email
      )) throw new Error("INSTITUTIONAL_GRANT_CONFLICT");

      if (existing?.status === "active" && existing.accessEndsAt === grant.expiresAt) {
        return { record: existing, duplicate: true, action: "unchanged" as const };
      }
      if (existing?.status === "active" &&
          Date.parse(existing.accessEndsAt || "") >= Date.parse(grant.expiresAt)) {
        throw new Error("INSTITUTIONAL_ACTIVE_CONFLICT");
      }
      if (existing?.status === "revoked" && !grant.allowReactivation) {
        throw new Error("INSTITUTIONAL_REACTIVATION_CONFIRMATION_REQUIRED");
      }
      const eventId = randomUUID();
      const action = existing?.status === "revoked" ? "reactivated" :
        existing ? "extended" : "granted";
      const record: InstitutionalEnrollmentRecord = {
        enrollmentId: id,
        entitlementId: id,
        tenantId: grant.tenantId,
        programId: grant.programId,
        offeringId: grant.offeringId,
        productId: "institutional:" + grant.programId,
        customerId: createHash("sha256").update(grant.email).digest("hex"),
        email: grant.email,
        ...(existing?.learnerId ? { learnerId: existing.learnerId } : {}),
        enrollmentSource: "institutional",
        status: "active",
        accessEndsAt: grant.expiresAt,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        lastProvider: "institutional",
        lastProviderEventId: eventId,
        lastEventAt: now,
        institutionalApprovedBy: actorUid,
        institutionalApprovedAt: now,
        institutionalReason: grant.reason,
        institutionalRevision: (existing?.institutionalRevision ?? 0) + 1,
      };
      // Preserve the original linked learner; do not overwrite payment ledger
      // or synthesize an external merchant transaction.
      tx.set(ref, record);
      tx.create(ref.collection("audit").doc(eventId), {
        action, actorUid, at: now,
        tenantId: grant.tenantId,
        programId: grant.programId,
        offeringId: grant.offeringId,
        reason: grant.reason,
        expiresAt: grant.expiresAt,
        revision: record.institutionalRevision,
      });
      return { record, duplicate: false, action };
    });
  }

  async revoke(
    tenantId: string, enrollmentId: string,
    actorUid: string, explanation: unknown,
  ) {
    const reason = parseInstitutionalRevocationReason(explanation);
    if (!/^[a-f0-9]{64}$/.test(enrollmentId)) {
      throw new Error("INSTITUTIONAL_ID_INVALID");
    }
    const ref = this.firestore.collection("commerceEnrollments").doc(enrollmentId);
    const now = new Date().toISOString();
    return this.firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error("INSTITUTIONAL_GRANT_NOT_FOUND");
      const current = snapshot.data() as InstitutionalEnrollmentRecord;
      if (current.enrollmentSource !== "institutional" ||
          current.tenantId !== tenantId || current.enrollmentId !== enrollmentId) {
        throw new Error("INSTITUTIONAL_GRANT_NOT_FOUND");
      }
      if (current.status === "revoked") {
        return { record: current, duplicate: true };
      }
      const eventId = randomUUID();
      const record: InstitutionalEnrollmentRecord = {
        ...current,
        status: "revoked",
        updatedAt: now,
        lastProvider: "institutional",
        lastProviderEventId: eventId,
        lastEventAt: now,
        institutionalRevokedAt: now,
        institutionalRevokedBy: actorUid,
        institutionalRevocationReason: reason,
        institutionalRevision: current.institutionalRevision + 1,
      };
      tx.set(ref, record);
      tx.create(ref.collection("audit").doc(eventId), {
        action: "revoked", actorUid,
        at: now, tenantId, reason,
        revision: record.institutionalRevision,
      });
      return { record, duplicate: false };
    });
  }

  async listPage(tenantId: string, limit = 50, cursor?: string) {
    if (limit < 1 || limit > 100 || !Number.isInteger(limit) ||
        (cursor && !/^[a-f0-9]{64}$/.test(cursor))) {
      throw new Error("INSTITUTIONAL_PAGE_INVALID");
    }
    // Query by tenant before pagination: no cross-tenant read or response.
    let query = this.firestore.collection("commerceEnrollments")
      .where("tenantId", "==", tenantId)
      .where("enrollmentSource", "==", "institutional")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    return {
      records: snapshot.docs.map(doc => doc.data() as CommerceEnrollmentRecord)
        .filter((row): row is InstitutionalEnrollmentRecord =>
          row.enrollmentSource === "institutional" && row.tenantId === tenantId)
        .map(row => ({
          enrollmentId: row.enrollmentId, email: row.email,
          tenantId: row.tenantId, programId: row.programId,
          offeringId: row.offeringId, status: row.status,
          accessEndsAt: row.accessEndsAt,
          learnerLinked: Boolean(row.learnerId),
          institutionalRevision: row.institutionalRevision,
          updatedAt: row.updatedAt,
        })),
      nextCursor: snapshot.size === limit ? snapshot.docs.at(-1)?.id ?? null : null,
    };
  }
}
