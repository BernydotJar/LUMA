import type { Firestore } from "firebase-admin/firestore";
import { parseDraftTenantId } from "./draft-input";

/** Narrow, read-only evidence consumed by publication preflight. */
export interface ScopedOfferingEvidence {
  readonly documentId: string;
  readonly tenantId: unknown;
  readonly programId: unknown;
  readonly offeringId: unknown;
  readonly status: unknown;
}

export interface ScopedOfferingReader {
  /** Returns at most 51 records; the 51st is a hard overflow signal. */
  listBoundedForProgram(tenantId: string, programId: string): Promise<readonly ScopedOfferingEvidence[]>;
}

/** Infrastructure adapter: query cannot be widened to an unscoped collection scan. */
export class FirestoreScopedOfferingReader implements ScopedOfferingReader {
  constructor(private readonly firestore: Firestore) {}

  async listBoundedForProgram(tenantId: string, programId: string): Promise<readonly ScopedOfferingEvidence[]> {
    parseDraftTenantId(tenantId);
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(programId)) {
      throw new Error("INSTITUTION_PREFLIGHT_PROGRAM_SCOPE_INVALID");
    }
    const records = await this.firestore.collection("programOfferings")
      .where("tenantId", "==", tenantId)
      .where("programId", "==", programId)
      .limit(51).get();
    return records.docs.map(doc => ({
      documentId: doc.id,
      tenantId: doc.get("tenantId"),
      programId: doc.get("programId"),
      offeringId: doc.get("offeringId"),
      status: doc.get("status"),
    }));
  }
}
