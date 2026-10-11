import { createHash, randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { parseDraftBrandInput, parseDraftCreateInput } from "./draft-input";
import { FirestoreInstitutionDraftStore } from "./draft-store";
import { FirestoreInstitutionPublicationInspector } from "./publication-preflight";
import { FirestoreScopedOfferingReader } from "./offering-reader";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? initializeApp({ projectId: process.env.GCLOUD_PROJECT },
  "publication-preflight-" + randomUUID()) : null;
const firestore = app ? getFirestore(app) : null;
const drafts = firestore ? new FirestoreInstitutionDraftStore(firestore) : null;
const inspector = firestore && drafts ? new FirestoreInstitutionPublicationInspector(drafts, new FirestoreScopedOfferingReader(firestore)) : null;
const tenant = () => "tenant-" + randomUUID();
const actor = () => "owner-" + randomUUID();
const requestId = () => "publish-preflight-" + randomUUID();

async function newDraft(tenantId: string, programIds: string[]) {
  await drafts!.createDraft(parseDraftCreateInput(tenantId, {
    templateId: "gruv-languages", programIds, expectedVersion: 0,
    requestId: requestId(), reasonCode: "institution-onboarding",
  }), actor());
}

async function setOffering(tenantId: string, programId: string, status: string, id = randomUUID()) {
  const docId = createHash("sha256").update(`${tenantId}/${programId}/${id}`).digest("hex");
  await firestore!.collection("programOfferings").doc(docId).set({
    offeringId: docId, tenantId, programId, status,
    cohortKey: id, title: "synthetic-only", coachIds: [],
  });
  return firestore!.collection("programOfferings").doc(docId);
}

describe.runIf(enabled)("Read-only publication preflight with real Firestore", () => {
  afterAll(async () => { if (app) await deleteApp(app); });

  it("never authorizes publication, even with full scoped active-offering evidence", async () => {
    const tenantId = tenant();
    await newDraft(tenantId, ["english", "conversation"]);
    await setOffering(tenantId, "english", "active");
    await setOffering(tenantId, "conversation", "active");
    const inspected = await inspector!.inspect(tenantId);
    expect(inspected.localChecksPassed).toBe(true);
    expect(inspected.activationAllowed).toBe(false);
    expect(inspected.status).toBe("blocked");
    expect(inspected.releaseBlockers).toHaveLength(3);
    expect(inspected.programs).toHaveLength(2);
    expect(inspected.programs.every(p => p.localStatus === "pass")).toBe(true);
    expect(inspected.inspectionDigest).toMatch(/^[a-f0-9]{64}$/);
    const repeat = await inspector!.inspect(tenantId);
    expect(repeat.inspectionDigest).toBe(inspected.inspectionDigest);
    expect(repeat.observedAt).toBeTruthy();
    // GET did not append a draft audit or create an active institution config.
    const draftId = createHash("sha256").update(tenantId).digest("hex");
    expect((await firestore!.collection("institutionConfigDrafts").doc(draftId)
      .collection("audit").get()).size).toBe(1);
    expect((await firestore!.collection("institutionConfigs").doc(draftId).get()).exists).toBe(false);
  });

  it("does not borrow active course offerings from another tenant with the same program ID", async () => {
    const a = tenant(); const b = tenant();
    await newDraft(a, ["english"]);
    await newDraft(b, ["english"]);
    await setOffering(b, "english", "active");
    await setOffering(a, "english", "draft");
    const resultA = await inspector!.inspect(a);
    const resultB = await inspector!.inspect(b);
    expect(resultA.localChecksPassed).toBe(false);
    expect(resultA.programs[0].blockers).toContain("NO_ACTIVE_OFFERING");
    expect(resultB.localChecksPassed).toBe(true);
    expect(resultB.activationAllowed).toBe(false);
  });

  it("distinguishes missing and corrupt drafts without tenant fallback", async () => {
    const missing = tenant();
    await expect(inspector!.inspect(missing)).rejects.toThrow("INSTITUTION_PREFLIGHT_DRAFT_NOT_FOUND");
    const a = tenant(); await newDraft(a, ["english"]);
    const key = createHash("sha256").update(a).digest("hex");
    await firestore!.collection("institutionConfigDrafts").doc(key).update({
      "config.tenantId": tenant(),
    });
    await expect(inspector!.inspect(a)).rejects.toThrow("INSTITUTION_DRAFT_CORRUPT");
  });

  it("rejects forged program IDs in a stored draft, even when the old scope validator accepts spaces", async () => {
    const a = tenant(); await newDraft(a, ["english"]);
    const key = createHash("sha256").update(a).digest("hex");
    await firestore!.collection("institutionConfigDrafts").doc(key)
      .update({ "config.programIds": ["bad program"] });
    await expect(inspector!.inspect(a)).rejects.toThrow("INSTITUTION_PREFLIGHT_DRAFT_CORRUPT");
  });

  it("rejects stored offering metadata that contradicts Firestore document identity", async () => {
    const a = tenant(); await newDraft(a, ["english"]);
    const record = await setOffering(a, "english", "active");
    await record.update({ offeringId: "wrong-document-key" });
    const inspected = await inspector!.inspect(a);
    expect(inspected.localChecksPassed).toBe(false);
    expect(inspected.programs[0].blockers).toEqual(["OFFERING_DATA_INVALID"]);
    expect(inspected.programs[0].activeOfferings).toBe(0);
  });

  it("blocks an over-cap collection rather than treating its first 50 results as complete", async () => {
    const a = tenant(); await newDraft(a, ["english"]);
    const batch = firestore!.batch();
    for (let i = 0; i < 51; i++) {
      const id = createHash("sha256").update(`${a}-${i}`).digest("hex");
      batch.set(firestore!.collection("programOfferings").doc(id), {
        offeringId: id, tenantId: a, programId: "english", status: "active",
      });
    }
    await batch.commit();
    const inspected = await inspector!.inspect(a);
    expect(inspected.localChecksPassed).toBe(false);
    expect(inspected.activationAllowed).toBe(false);
    expect(inspected.programs[0].blockers).toContain("OFFERING_LIMIT_EXCEEDED");
    expect(inspected.programs[0].activeOfferings).toBe(0);
  });

  it("tracks changes between two non-active statuses in the advisory digest", async () => {
    const a = tenant(); await newDraft(a, ["english"]);
    const offering = await setOffering(a, "english", "draft");
    const first = await inspector!.inspect(a);
    expect(first.localChecksPassed).toBe(false);
    await offering.update({ status: "completed" });
    const second = await inspector!.inspect(a);
    expect(second.localChecksPassed).toBe(false);
    expect(second.inspectionDigest).not.toBe(first.inspectionDigest);
    expect(second.activationAllowed).toBe(false);
  });

  it("changes digest after underlying status or draft revision changes", async () => {
    const a = tenant(); await newDraft(a, ["english"]);
    const offering = await setOffering(a, "english", "active");
    const first = await inspector!.inspect(a);
    await offering.update({ status: "archived" });
    const second = await inspector!.inspect(a);
    expect(second.localChecksPassed).toBe(false);
    expect(second.programs[0].blockers).toContain("NO_ACTIVE_OFFERING");
    expect(second.inspectionDigest).not.toBe(first.inspectionDigest);
    const edit = parseDraftBrandInput(a, {
      brand: { displayName: "GRUV English", shortName: "GRUV", palette: ["#FFCCAA", "#332211"] },
      expectedVersion: 1, requestId: requestId(), reasonCode: "brand-update",
    });
    await drafts!.updateDraftBrand(edit, actor());
    const third = await inspector!.inspect(a);
    expect(third.configVersion).toBe(2);
    expect(third.inspectionDigest).not.toBe(second.inspectionDigest);
    expect(third.activationAllowed).toBe(false);
  });
});
