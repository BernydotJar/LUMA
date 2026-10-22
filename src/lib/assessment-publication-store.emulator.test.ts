import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreAssessmentPublicationStore } from "./assessment-publication-store";
import { assessmentCatalogPaths, loadPublishedProgramAssessment } from "./program-assessment-registry";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.GCLOUD_PROJECT?.startsWith("demo-"));
const app = enabled ? initializeApp({ projectId: process.env.GCLOUD_PROJECT },
  "assessment-publisher-" + randomUUID()) : null;
const db = app ? getFirestore(app) : null;
const publisher = db ? new FirestoreAssessmentPublicationStore(db) : null;
const scope = (suffix = randomUUID()) => ({ tenantId: "inst_" + suffix, programId: "pnl_" + suffix });
const uid = () => "admin-" + randomUUID();
const id = () => "request-" + randomUUID();
const slugs = ["calibracion-observar-antes-de-interpretar", "congruencia-tres-canales"];
const offer = async (s: ReturnType<typeof scope>) => {
  const offeringId = "offering-" + randomUUID();
  const ref = db!.collection("programOfferings").doc(offeringId);
  await ref.set({ offeringId, ...s, status: "active" });
  return ref;
};
const prep = (offeringId: string, expectedPlanRevision = 0, version = "practitioner-entry-v1") => ({
  requestId: id(), expectedPlanRevision, offeringId, version,
  curriculumRevision: "pnl-revision-v1", classSlugs: slugs,
  recommendedNextSlug: slugs[0], reasonCode: "new-curriculum" as const,
});
const review = (expectedPlanRevision = 1) => ({
  requestId: id(), expectedPlanRevision, action: "review" as const,
  reasonCode: "reviewed-with-rights-evidence",
  rightsRecordId: "legal-dossier-2026",
  rightsEvidenceSha256: "a".repeat(64),
});
const publish = (expectedPlanRevision = 2) => ({
  requestId: id(), expectedPlanRevision, action: "publish" as const,
  reasonCode: "publish-reviewed-curriculum",
});
const withdraw = (expectedPlanRevision: number) => ({
  requestId: id(), expectedPlanRevision, action: "withdraw" as const,
  reasonCode: "rights-revoked",
});

describe.runIf(enabled)("LUMA P0 institutional assessment publisher / Firestore", () => {
  afterAll(async () => { if (app) await deleteApp(app); });
  it("author prepares -> separate reviewer approves -> publisher creates immutable class-scoped version", async () => {
    const s = scope(); const offering = await offer(s);
    const author = uid(); const reviewer = uid();
    const proposal = prep(offering.id);
    const created = await publisher!.prepare(s, proposal, author);
    expect(created).toMatchObject({ appliedRevision: 1, status: "prepared", activeVersion: null });
    expect(await publisher!.prepare(s, proposal, author)).toMatchObject({ duplicate: true, appliedRevision: 1 });
    await expect(publisher!.prepare(s, proposal, reviewer))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_REQUEST_REUSE_CONFLICT");
    expect(await loadPublishedProgramAssessment(db!, s)).toBeNull();

    const reviewCmd = review();
    await expect(publisher!.transition(s, reviewCmd, author))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_SELF_REVIEW_FORBIDDEN");
    const accepted = await publisher!.transition(s, reviewCmd, reviewer);
    expect(accepted).toMatchObject({ appliedRevision: 2, status: "reviewed" });
    expect(await loadPublishedProgramAssessment(db!, s)).toBeNull();
    expect(await publisher!.transition(s, reviewCmd, reviewer))
      .toMatchObject({ duplicate: true, appliedRevision: 2 });

    const published = await publisher!.transition(s, publish(), author);
    expect(published).toMatchObject({
      appliedRevision: 3, status: "published", activeVersion: proposal.version,
    });
    const current = await loadPublishedProgramAssessment(db!, s);
    expect(current).toMatchObject({
      tenantId: s.tenantId, programId: s.programId, offeringId: offering.id,
      version: proposal.version, approvedByUid: reviewer,
      submittedByUid: author,
    });
    const paths = assessmentCatalogPaths(s);
    const version = await db!.doc(paths.version(proposal.version)).get();
    expect(version.data()?.rightsRecordId).toBe("legal-dossier-2026");
    expect(version.data()?.rightsEvidenceSha256).toBe("a".repeat(64));
    expect((await publisher!.get(s)).publication).toEqual({
      status: "published", activeVersion: proposal.version,
    });
    const planRef = db!.collection("assessmentPublicationPlans")
      .doc((await db!.collection("assessmentPublicationPlans").where("tenantId","==",s.tenantId).get()).docs[0].id);
    expect((await planRef.collection("revisions").get()).size).toBe(3);
    expect((await planRef.collection("audit").get()).size).toBe(3);
    expect((await db!.doc(paths.version(proposal.version)).get()).data()?.status).toBe("approved");
  }, 40000);

  it("withdraws published pointer immediately without deleting the old approved revision", async () => {
    const s=scope(); const o=await offer(s); const author=uid(); const reviewer=uid();
    const prepared=prep(o.id);
    await publisher!.prepare(s, prepared, author);
    await publisher!.transition(s, review(), reviewer);
    await publisher!.transition(s, publish(), author);
    expect(await loadPublishedProgramAssessment(db!, s)).not.toBeNull();
    const cmd=withdraw(3);
    const receipt=await publisher!.transition(s,cmd,author);
    expect(receipt).toMatchObject({status:"withdrawn",activeVersion:null,appliedRevision:4});
    expect(await loadPublishedProgramAssessment(db!, s)).toBeNull();
    expect((await db!.doc(assessmentCatalogPaths(s).version(prepared.version)).get()).exists).toBe(true);
    expect(await publisher!.transition(s,cmd,author)).toMatchObject({duplicate:true,appliedRevision:4});
    await expect(publisher!.transition(s,review(4),reviewer))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_STATE_CONFLICT");
    await expect(publisher!.prepare(s,prep(o.id,4,prepared.version),author))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_VERSION_REUSED");
    expect(await publisher!.prepare(s,prep(o.id,4,"practitioner-entry-v2"),author))
      .toMatchObject({status:"prepared",appliedRevision:5,activeVersion:null});
  }, 40000);

  it("withdraws a draft without disabling an already published previous version", async () => {
    const s=scope();const o=await offer(s);const author=uid();const reviewer=uid();
    const v1=prep(o.id);
    await publisher!.prepare(s,v1,author);
    await publisher!.transition(s,review(),reviewer);
    await publisher!.transition(s,publish(),author);
    const v2=prep(o.id,3,"practitioner-entry-v2");
    await publisher!.prepare(s,v2,author);
    await publisher!.transition(s,withdraw(4),author);
    expect((await loadPublishedProgramAssessment(db!,s))?.version).toBe(v1.version);
  }, 40000);

  it("rejects stale versions, forged source memberships, and changed published pointer", async () => {
    const s=scope();const o=await offer(s);const author=uid();const reviewer=uid();
    await expect(publisher!.prepare(s,{...prep(o.id),classSlugs:["foreign"]},author))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_CLASS_UNAVAILABLE");
    await expect(publisher!.prepare(s,prep("invalid-offering"),author))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_OFFERING_UNAVAILABLE");
    await publisher!.prepare(s,prep(o.id),author);
    await o.update({status:"draft"});
    await expect(publisher!.transition(s,review(),reviewer))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_OFFERING_UNAVAILABLE");
    await o.update({status:"active"});
    await publisher!.transition(s,review(),reviewer);
    const pointer=db!.doc(assessmentCatalogPaths(s).pointer);
    await pointer.set({schemaVersion:1,...s,status:"withdrawn",
      activeVersion:"other-entry-v1",offeringId:o.id});
    await expect(publisher!.transition(s,publish(),author))
      .rejects.toThrow("ASSESSMENT_PUBLICATION_PUBLISHED_HEAD_CHANGED");
    expect(await loadPublishedProgramAssessment(db!,s)).toBeNull();
  },40000);

  it("serializes simultaneous reviewers via plan revision CAS", async () => {
    const s=scope(); const o=await offer(s);
    await publisher!.prepare(s,prep(o.id),uid());
    const [a,b]=await Promise.allSettled([
      publisher!.transition(s,review(),uid()),
      publisher!.transition(s,review(),uid()),
    ]);
    expect([a.status,b.status].sort()).toEqual(["fulfilled","rejected"]);
    expect((await publisher!.get(s)).plan?.planRevision).toBe(2);
  },40000);

  it("does not let withdrawal from one academy affect another", async () => {
    const s1=scope(),s2=scope();const o1=await offer(s1),o2=await offer(s2);
    const a=uid(),b=uid();
    for (const [s,o] of [[s1,o1],[s2,o2]] as const) {
      await publisher!.prepare(s,prep(o.id),a);
      await publisher!.transition(s,review(),b);
      await publisher!.transition(s,publish(),a);
    }
    await publisher!.transition(s1,withdraw(3),a);
    expect(await loadPublishedProgramAssessment(db!,s1)).toBeNull();
    expect(await loadPublishedProgramAssessment(db!,s2)).not.toBeNull();
  },40000);
});
