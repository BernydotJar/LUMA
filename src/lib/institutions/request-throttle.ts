import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

/** Identity-scoped Firestore abuse budget. Supplement, never replace edge WAF/App Check. */
export class FirestoreInstitutionRequestThrottle {
  constructor(private readonly firestore: Firestore) {}

  async consume(uid: string, action: "application-submit" | "invitation-accept",
    now = Date.now()): Promise<void> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error("APPLICATION_RATE_LIMITED");
    const windowMs = 15 * 60_000;
    const bucket = Math.floor(now / windowMs);
    const max = action === "application-submit" ? 30 : 12;
    const key = createHash("sha256").update(`${action}:${uid}:${bucket}`).digest("hex");
    const ref = this.firestore.collection("institutionRequestRateWindows").doc(key);
    await this.firestore.runTransaction(async tx => {
      const snap = await tx.get(ref);
      const count = snap.exists ? snap.data()?.count : 0;
      if (!Number.isSafeInteger(count) || count < 0 || count >= max) {
        throw new Error("APPLICATION_RATE_LIMITED");
      }
      // Raw UID, email and IP are never stored in the abuse-control record.
      const row = { action, count: count + 1, updatedAt: new Date(now).toISOString(),
        deleteAfter: new Date((bucket + 2) * windowMs).toISOString() };
      tx.set(ref, row);
    });
  }
}
