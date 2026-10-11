import { createHash, randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { parseDraftBrandInput, parseDraftCreateInput } from "./draft-input";
import { FirestoreInstitutionDraftStore } from "./draft-store";
import { FirestoreScopedOfferingReader } from "./offering-reader";
import { FirestoreInstitutionPublicationInspector } from "./publication-preflight";
import { parsePreparePlanInput, parseReviewPlanInput } from "./publication-plan-input";
import { FirestoreInstitutionPublicationPlanStore } from "./publication-plan-store";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST &&
  process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? initializeApp({ projectId: process.env.GCLOUD_PROJECT },
  "publication-plan-" + randomUUID()) : null;
const db = app ? getFirestore(app) : null;
const drafts = db ? new FirestoreInstitutionDraftStore(db) : null;
const inspector = db && drafts ? new FirestoreInstitutionPublicationInspector(
  { getDraftForTenant: id => drafts.getDraftForTenant(id) }, new FirestoreScopedOfferingReader(db)) : null;
const plans = db && inspector ? new FirestoreInstitutionPublicationPlanStore(db, inspector) : null;
const tenant = () => "tenant-" + randomUUID();
const requestId = () => "plan-command-" + randomUUID();
const uid = () => "super-" + randomUUID();
const docId = (id: string) => createHash("sha256").update(id).digest("hex");

async function setup(tenantId: string, programId = "english") {
  await drafts!.createDraft(parseDraftCreateInput(tenantId, {
    templateId: "gruv-languages", programIds: [programId], expectedVersion: 0,
    requestId: requestId(), reasonCode: "institution-onboarding",
  }), uid());
  const id = docId(`${tenantId}/${programId}`);
  const offering = db!.collection("programOfferings").doc(id);
  await offering.set({ offeringId: id, tenantId, programId, status: "active" });
  const preflight = await inspector!.inspect(tenantId);
  expect(preflight.localChecksPassed).toBe(true);
  expect(preflight.activationAllowed).toBe(false);
  return { offering, input: parsePreparePlanInput(tenantId, {
    requestId: requestId(), expectedPlanRevision: 0, expectedDraftVersion: 1,
    expectedReadinessDigest: preflight.inspectionDigest,
  }) };
}
const review = (tenantId: string, version: number, actorAction: "review" | "withdraw" = "review", id = requestId()) =>
  parseReviewPlanInput(tenantId, {
    requestId: id, expectedPlanRevision: version, action: actorAction,
    reasonCode: actorAction === "review" ? "reviewed-for-next-gate" : "security-stop",
  });

const planRecord = (tenantId: string) => db!.collection("institutionPublicationPlans").doc(docId(tenantId));

describe.runIf(enabled)("Transactional publication planning, dual control and safe withdrawal", () => {
  afterAll(async () => { if (app) await deleteApp(app); });

  it("prepares an inert candidate and stores immutable audit+revision once", async () => {
    const id = tenant(); const author = uid(); const { input } = await setup(id);
    const first = await plans!.prepare(input, author);
    expect(first).toEqual({ tenantId: id, appliedPlanRevision: 1, status: "prepared", duplicate: false, activationAllowed: false });
    const repeat = await plans!.prepare(input, author);
    expect(repeat).toMatchObject({ appliedPlanRevision: 1, duplicate: true });
    await expect(plans!.prepare(input, uid())).rejects.toThrow("INSTITUTION_PLAN_REQUEST_REUSE_CONFLICT");
    const head = (await plans!.getPlanForTenant(id))!;
    expect(head).toMatchObject({ tenantId: id, planRevision: 1, status: "prepared", activationAllowed: false });
    expect((await planRecord(id).collection("audit").get()).size).toBe(1);
    expect((await planRecord(id).collection("revisions").get()).size).toBe(1);
    expect((await db!.collection("institutionConfigs").doc(docId(id)).get()).exists).toBe(false);
    expect((plans as unknown as Record<string, unknown>).getByTenantId).toBeUndefined();
    expect((plans as unknown as Record<string, unknown>).publish).toBeUndefined();
  });

  it("requires a second authorized actor; review never activates the tenant", async () => {
    const id = tenant(); const preparedBy = uid(); const reviewedBy = uid();
    const { input } = await setup(id);
    await plans!.prepare(input, preparedBy);
    const command = review(id, 1);
    await expect(plans!.transition(command, preparedBy)).rejects.toThrow("INSTITUTION_PLAN_SELF_REVIEW_FORBIDDEN");
    const approved = await plans!.transition(command, reviewedBy);
    expect(approved).toMatchObject({ appliedPlanRevision: 2, status: "reviewed", activationAllowed: false });
    expect(await plans!.transition(command, reviewedBy)).toMatchObject({ appliedPlanRevision: 2, duplicate: true });
    expect((await plans!.getPlanForTenant(id))?.reviewedBy).toBe(reviewedBy);
    expect((await planRecord(id).collection("revisions").get()).size).toBe(2);
    expect((await db!.collection("institutionConfigs").doc(docId(id)).get()).exists).toBe(false);
  });

  it("rechecks evidence at review and rejects archived offerings/draft edits", async () => {
    const id = tenant(); const owner = uid(); const { input, offering } = await setup(id);
    await plans!.prepare(input, owner);
    await offering.update({ status: "archived" });
    await expect(plans!.transition(review(id, 1), uid())).rejects.toThrow("INSTITUTION_PLAN_READINESS_CHANGED");
    expect((await plans!.getPlanForTenant(id))?.status).toBe("prepared");
    await offering.update({ status: "active" });
    const patch = parseDraftBrandInput(id, {
      expectedVersion: 1, reasonCode: "brand-update", requestId: requestId(),
      brand: { displayName: "New Organization", shortName: "GRUV", palette: ["#123456", "#ABCDEF"] },
    });
    await drafts!.updateDraftBrand(patch, uid());
    await expect(plans!.transition(review(id, 1), uid())).rejects.toThrow("INSTITUTION_PLAN_READINESS_CHANGED");
  });

  it("withdraws during preflight outage, preserves history, and enables a fresh nonactive plan", async () => {
    const id = tenant(); const preparer = uid(); const reviewer = uid(); const emergencyActor = uid();
    const { input } = await setup(id);
    await plans!.prepare(input, preparer);
    await plans!.transition(review(id, 1), reviewer);
    const preflightOffline = new FirestoreInstitutionPublicationPlanStore(db!, {
      inspect: async () => { throw new Error("INSPECTOR_DOWN"); },
    });
    const command = review(id, 2, "withdraw");
    const result = await preflightOffline.transition(command, emergencyActor);
    expect(result).toMatchObject({ appliedPlanRevision: 3, status: "withdrawn", activationAllowed: false });
    expect(await preflightOffline.transition(command, emergencyActor)).toMatchObject({ duplicate: true, appliedPlanRevision: 3 });
    expect(await preflightOffline.prepare(input, preparer)).toMatchObject({ duplicate: true, appliedPlanRevision: 1 });
    // A withdrawn revision cannot be re-reviewed under a fresh request ID.
    await expect(plans!.transition(review(id, 3), reviewer))
      .rejects.toThrow("INSTITUTION_PLAN_STATE_CONFLICT");
    const nextPreflight = await inspector!.inspect(id);
    const next = parsePreparePlanInput(id, {
      requestId: requestId(), expectedPlanRevision: 3,
      expectedDraftVersion: 1, expectedReadinessDigest: nextPreflight.inspectionDigest,
    });
    expect(await plans!.prepare(next, preparer)).toMatchObject({ appliedPlanRevision: 4, status: "prepared", activationAllowed: false });
    expect((await planRecord(id).collection("revisions").get()).size).toBe(4);
    expect((await planRecord(id).collection("audit").get()).size).toBe(4);
    const before = (await planRecord(id).collection("revisions").doc("000000000001").get()).data();
    expect(before?.status).toBe("prepared");
    const history = (await planRecord(id).collection("revisions").doc("000000000003").get()).data();
    expect(history?.action).toBe("withdraw");
    expect(history?.reasonCode).toBe("security-stop");
    expect(history?.activationAllowed).toBe(false);
    await expect(plans!.transition(review(id, 2), reviewer)).rejects.toThrow("INSTITUTION_PLAN_VERSION_CONFLICT");
    expect((await plans!.getPlanForTenant(id))?.reviewedBy).toBeUndefined();
  });

  it("prevents stale CAS and simultaneous competing reviewers", async () => {
    const id = tenant(); const owner = uid(); const { input } = await setup(id);
    await plans!.prepare(input, owner);
    await expect(plans!.transition(review(id, 7), uid())).rejects.toThrow("INSTITUTION_PLAN_VERSION_CONFLICT");
    const [a, b] = await Promise.allSettled([
      plans!.transition(review(id, 1), uid()),
      plans!.transition(review(id, 1), uid()),
    ]);
    expect([a.status, b.status].sort()).toEqual(["fulfilled", "rejected"]);
    const failed = a.status === "rejected" ? a.reason : (b as PromiseRejectedResult).reason;
    expect(String(failed)).toContain("INSTITUTION_PLAN_VERSION_CONFLICT");
    expect((await plans!.getPlanForTenant(id))?.planRevision).toBe(2);
    expect((await planRecord(id).collection("revisions").get()).size).toBe(2);
  });

  it("rejects malformed internals, reused identifiers and cross-tenant corrupted records", async () => {
    const a = tenant(); const b = tenant(); const actor = uid(); const { input } = await setup(a);
    await expect(plans!.prepare({ ...input, requestId: "short" }, actor)).rejects.toThrow();
    await plans!.prepare(input, actor);
    await expect(plans!.prepare({ ...input, expectedPlanRevision: 3 }, actor))
      .rejects.toThrow("INSTITUTION_PLAN_REQUEST_REUSE_CONFLICT");
    await expect(plans!.getPlanForTenant(b)).resolves.toBeNull();
    await planRecord(a).update({ tenantId: b });
    await expect(plans!.getPlanForTenant(a)).rejects.toThrow("INSTITUTION_PLAN_CORRUPT");
  });

  it("rejects a plan digest changed between preflight and the review transaction", async () => {
    const a = tenant(); const owner = uid(); const { input } = await setup(a);
    await plans!.prepare(input, owner);
    const injectingInspector = new FirestoreInstitutionPublicationPlanStore(db!, {
      inspect: async scope => {
        const snapshot = await inspector!.inspect(scope);
        // Simulate a concurrent mutation that keeps planRevision unchanged.
        await planRecord(a).update({ readinessDigest: "f".repeat(64) });
        return snapshot;
      },
    });
    await expect(injectingInspector.transition(review(a, 1), uid()))
      .rejects.toThrow("INSTITUTION_PLAN_READINESS_CHANGED");
    expect((await plans!.getPlanForTenant(a))?.status).toBe("prepared");
  });

  it("rejects a draft mutation between read-only preflight and plan transaction", async () => {
    const a = tenant(); const { input } = await setup(a);
    const injectingInspector = new FirestoreInstitutionPublicationPlanStore(db!, {
      inspect: async scope => {
        const snapshot = await inspector!.inspect(scope);
        await db!.collection("institutionConfigDrafts").doc(docId(a)).update({ "config.configVersion": 2 });
        return snapshot;
      },
    });
    await expect(injectingInspector.prepare(input, uid()))
      .rejects.toThrow("INSTITUTION_PLAN_DRAFT_CHANGED");
    expect((await planRecord(a).get()).exists).toBe(false);
  });

  it("fails closed when readiness is blocked even with a syntactically valid requested digest", async () => {
    const a = tenant(); const { input, offering } = await setup(a);
    await offering.update({ status: "archived" });
    await expect(plans!.prepare(input, uid())).rejects.toThrow("INSTITUTION_PLAN_READINESS_CHANGED");
    expect((await planRecord(a).get()).exists).toBe(false);
  });
});
