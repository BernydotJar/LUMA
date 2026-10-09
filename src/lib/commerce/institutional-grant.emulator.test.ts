import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreInstitutionalGrantStore } from "./institutional-grant-store";
import { parseInstitutionalBulkInput, runInstitutionalBulk } from "./institutional-bulk";
import { FirestoreCommerceEnrollmentStore, isActiveCommerceEnrollment } from "./enrollment";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const app = enabled
  ? initializeApp({
    projectId: process.env.GCLOUD_PROJECT || "demo-luma-institutional-grants",
  }, "luma-institutional-grants-" + randomUUID())
  : undefined;
const firestore = app ? getFirestore(app) : undefined;
const store = firestore ? new FirestoreInstitutionalGrantStore(firestore) : undefined;
const enrollments = firestore ? new FirestoreCommerceEnrollmentStore(firestore) : undefined;

function future(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

describe.runIf(enabled)("institutional enrollment Firestore integration", () => {
  afterAll(async () => { if (app) await deleteApp(app); });

  it("grants, links a verified learner, prevents duplicate, revokes and requires confirmed reactivation", async () => {
    const suffix = randomUUID();
    const tenantId = "tenant-" + suffix;
    const programId = "program-" + suffix;
    const offeringId = "offering-" + suffix;
    const email = "invited-" + suffix + "@example.org";
    const offering = firestore!.collection("programOfferings").doc(offeringId);
    await offering.set({
      offeringId, tenantId, programId, cohortKey: "2026-A", title: "Cohorte intensiva",
      deliveryMode: "live", timezone: "America/Guatemala",
      status: "active", coachIds: [], createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const grant = {
      tenantId, programId, offeringId, email,
      reason: "Autorización institucional documentada para beca o acceso por convenio.",
      expiresAt: future(200),
    };

    const first = await store!.grant(grant, "admin-1");
    expect(first.action).toBe("granted");
    expect(first.record).toMatchObject({ status: "active", enrollmentSource: "institutional" });
    const replay = await store!.grant(grant, "admin-1");
    expect(replay.duplicate).toBe(true);
    const audits1 = await firestore!.collection("commerceEnrollments")
      .doc(first.record.enrollmentId).collection("audit").get();
    expect(audits1.size).toBe(1);

    const claimed = await enrollments!.claimByEmail("firebase-" + suffix, email.toUpperCase(), tenantId);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].learnerId).toBe("firebase-" + suffix);
    expect(isActiveCommerceEnrollment(claimed[0])).toBe(true);

    const extended = await store!.grant({ ...grant, expiresAt: future(320) }, "admin-1");
    expect(extended.action).toBe("extended");
    expect(extended.record.learnerId).toBe("firebase-" + suffix);
    const revoked = await store!.revoke(tenantId, first.record.enrollmentId,
      "admin-1", "La institución canceló formalmente este acceso de acuerdo con su convenio.");
    expect(revoked.duplicate).toBe(false);
    expect(isActiveCommerceEnrollment(revoked.record)).toBe(false);
    const revokedAgain = await store!.revoke(tenantId, first.record.enrollmentId,
      "admin-1", "La institución canceló formalmente este acceso de acuerdo con su convenio.");
    expect(revokedAgain.duplicate).toBe(true);
    await expect(store!.grant({ ...grant, expiresAt: future(350) }, "admin-1"))
      .rejects.toThrow("INSTITUTIONAL_REACTIVATION_CONFIRMATION_REQUIRED");
    const reopened = await store!.grant({
      ...grant, expiresAt: future(350), allowReactivation: true,
    }, "admin-2");
    expect(reopened.action).toBe("reactivated");
    expect(reopened.record.learnerId).toBe("firebase-" + suffix);
    const audits = await firestore!.collection("commerceEnrollments")
      .doc(first.record.enrollmentId).collection("audit").get();
    expect(audits.size).toBe(4);
    // Manual admission does not fabricate a merchant entitlement or payment record.
    const merchantEntitlement = await firestore!.collection("commerceTenants")
      .doc("not-applicable").collection("entitlements").doc(first.record.entitlementId).get();
    expect(merchantEntitlement.exists).toBe(false);
  });

  it("rejects cross-tenant offering use, inactive cohort and cross-tenant revocation", async () => {
    const suffix = randomUUID();
    const offeringId = "o-" + suffix;
    await firestore!.collection("programOfferings").doc(offeringId).set({
      offeringId, tenantId: "alpha-" + suffix, programId: "program-a",
      status: "draft", cohortKey: "new",
    });
    const base = {
      tenantId: "alpha-" + suffix,
      programId: "program-a", offeringId,
      email: "learner-" + suffix + "@example.org",
      reason: "Autorización documentada por la administración del programa.",
      expiresAt: future(160),
    };
    await expect(store!.grant(base, "admin")).rejects.toThrow("INSTITUTIONAL_OFFERING_NOT_ACTIVE");
    await firestore!.collection("programOfferings").doc(offeringId).update({ status: "active" });
    await expect(store!.grant({ ...base, tenantId: "beta-" + suffix }, "admin"))
      .rejects.toThrow("INSTITUTIONAL_OFFERING_NOT_ACTIVE");
    const first = await store!.grant(base, "admin");
    await expect(store!.revoke("beta-" + suffix, first.record.enrollmentId,
      "admin", "Documentada cancelación de la matrícula institucional."))
      .rejects.toThrow("INSTITUTIONAL_GRANT_NOT_FOUND");
    const [forAlpha, forBeta] = await Promise.all([
      store!.listPage("alpha-" + suffix), store!.listPage("beta-" + suffix),
    ]);
    expect(forAlpha.records).toHaveLength(1);
    expect(forBeta.records).toHaveLength(0);
  });
  it("grants a batch, handles invalid/duplicate rows, replays safely, and maintains audits", async () => {
    const suffix = randomUUID();
    const tenantId = "tenant-bulk-" + suffix;
    const offeringId = "offering-bulk-" + suffix;
    const programId = "leadership-" + suffix;
    await firestore!.collection("programOfferings").doc(offeringId).set({
      offeringId, tenantId, programId, status: "active",
      cohortKey: "corporate-2026", title: "Leadership cohort",
      deliveryMode: "hybrid", timezone: "America/Guatemala",
      coachIds: [],
    });
    const base = {
      tenantId, offeringId, programId,
      reason: "Contracted seats granted under an authorized corporate education agreement.",
      expiresAt: future(180),
      emails: [
        "ONE-" + suffix + "@example.org",
        "one-" + suffix + "@example.org",
        "invalid-email",
        "two-" + suffix + "@example.org",
      ],
    };

    const first = await runInstitutionalBulk(parseInstitutionalBulkInput(base), "tenant-admin", store!);
    expect(first.rows.map(row => row.status))
      .toEqual(["granted", "duplicate_input", "invalid", "granted"]);
    expect(first.summary).toMatchObject({ requested: 4, granted: 2, invalid: 1, duplicate_input: 1 });
    const initialId = first.rows[0].enrollmentId!;
    const audit = await firestore!.collection("commerceEnrollments")
      .doc(initialId).collection("audit").get();
    expect(audit.size).toBe(1);
    const claimant = "learner-" + suffix;
    const claimed = await enrollments!.claimByEmail(claimant, "ONE-" + suffix + "@EXAMPLE.ORG", tenantId);
    expect(claimed).toHaveLength(1);
    expect(claimed[0].learnerId).toBe(claimant);

    const replay = await runInstitutionalBulk(parseInstitutionalBulkInput(base), "tenant-admin", store!);
    expect(replay.summary.unchanged).toBe(2);
    expect((await firestore!.collection("commerceEnrollments")
      .doc(initialId).collection("audit").get()).size).toBe(1);
    await store!.revoke(tenantId, initialId, "tenant-admin",
      "This corporate training seat was withdrawn at the institution's request.");
    const blocked = await runInstitutionalBulk(parseInstitutionalBulkInput(base), "tenant-admin", store!);
    expect(blocked.summary.rejected).toBe(1);
    expect(blocked.rows[0].error).toBe("institutional_reactivation_confirmation_required");
    const reactivated = await runInstitutionalBulk(
      parseInstitutionalBulkInput({ ...base, allowReactivation: true }), "tenant-admin", store!,
    );
    expect(reactivated.rows[0].status).toBe("reactivated");
    expect(reactivated.rows[0].enrollmentId).toBe(initialId);
    expect((await firestore!.collection("commerceEnrollments")
      .doc(initialId).collection("audit").get()).size).toBe(3);
  });

});
