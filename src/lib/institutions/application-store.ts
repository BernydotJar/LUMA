import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  matchesExistingAcademyApplication,
  type AcademyApplicationInput,
  type AcademyApplicationRecord,
} from "./application";

export interface VerifiedAcademyApplicant { uid: string; email: string; email_verified: true }

/** One immutable application per verified Firebase identity; no tenant or role writes. */
export class FirestoreAcademyApplicationStore {
  constructor(private readonly db: Firestore) {}

  private ref(uid: string) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("APPLICATION_IDENTITY_INVALID");
    const hash = createHash("sha256")
      .update("luma-institution-request-v1:" + uid).digest("hex");
    return this.db.collection("institutionApplications").doc(hash);
  }

  async get(uid: string): Promise<AcademyApplicationRecord | null> {
    const snapshot = await this.ref(uid).get();
    if (!snapshot.exists) return null;
    const row = snapshot.data() as AcademyApplicationRecord;
    if (row.applicantUid !== uid || row.applicationId !== snapshot.id) {
      throw new Error("APPLICATION_RECORD_INVALID");
    }
    return row;
  }

  async submit(
    identity: VerifiedAcademyApplicant,
    requested: AcademyApplicationInput,
    now = new Date().toISOString(),
  ): Promise<{ application: AcademyApplicationRecord; duplicate: boolean }> {
    if (!identity.email_verified || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email) ||
        identity.email.length > 320 || !Number.isFinite(Date.parse(now))) {
      throw new Error("APPLICATION_IDENTITY_INVALID");
    }
    const ref = this.ref(identity.uid);
    return this.db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.exists) {
        const existing = current.data() as AcademyApplicationRecord;
        if (existing.applicantUid !== identity.uid || existing.applicationId !== ref.id ||
            !matchesExistingAcademyApplication(existing, requested)) {
          throw new Error("APPLICATION_ALREADY_SUBMITTED");
        }
        return { application: existing, duplicate: true };
      }
      const application: AcademyApplicationRecord = {
        ...requested,
        applicationId: ref.id,
        applicantUid: identity.uid,
        applicantEmail: identity.email.toLowerCase(),
        status: "received", createdAt: now, updatedAt: now,
      };
      tx.create(ref, application);
      return { application, duplicate: false };
    });
  }
}
