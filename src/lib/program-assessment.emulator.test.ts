import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreLearningStore } from "./learning-store";
import { evaluateProgramEntryAssessment, getProgramEntryQuestions } from "./program-assessment";
import { getClassContract } from "./class-contract";
import { assessmentCatalogPaths, SE_PRACTITIONER_CLASS_SLUGS, type PublishedProgramAssessment } from "./program-assessment-registry";

const available = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const app = available
  ? initializeApp(
      { projectId: process.env.GCLOUD_PROJECT || "demo-luma-program-entry" },
      "entry-assessment-" + randomUUID(),
    )
  : undefined;

const allCorrect = Object.fromEntries(getProgramEntryQuestions().map((q) => [
  q.slug, getClassContract(q.slug)!.diagnostic.choices.find((c) => c.correct)!.id,
])) as Record<string, string>;

async function publishTestAssessment(scope: { tenantId: string; programId: string }) {
  const store = getFirestore(app!);
  const offeringId = "approved-offering-" + scope.programId;
  const version = "se-practitioner-entry-v1";
  const approved: PublishedProgramAssessment = {
    ...scope, offeringId, version, curriculumRevision: "se-revision-v1",
    classSlugs: [...SE_PRACTITIONER_CLASS_SLUGS],
    sourceIds: [...new Set(SE_PRACTITIONER_CLASS_SLUGS.flatMap((slug) => getClassContract(slug)!.sourceIds))],
    recommendedNextSlug: SE_PRACTITIONER_CLASS_SLUGS.at(-1)!,
    submittedByUid: "course-author", approvedByUid: "course-reviewer",
    approvedAt: "2026-10-20T12:00:00.000Z", publishedAt: "2026-10-20T13:00:00.000Z",
  };
  const paths = assessmentCatalogPaths(scope);
  await store.collection("programOfferings").doc(offeringId).set({
    offeringId, ...scope, status: "active",
  });
  await store.doc(paths.pointer).set({
    schemaVersion: 1, ...scope, status: "published", activeVersion: version, offeringId,
  });
  await store.doc(paths.version(version)).set({
    schemaVersion: 1, status: "approved", ...approved,
  });
  return approved;
}

function newEvent(approved: PublishedProgramAssessment) {
  const summary = evaluateProgramEntryAssessment(allCorrect, new Date().toISOString(), approved)!;
  return {
    type: "PROGRAM_ENTRY_ASSESSMENT_COMPLETED",
    evidenceCategory: "observed" as const,
    twinAuthority: "none" as const,
    sourceId: summary.version,
    completedAt: summary.completedAt,
    programAssessment: summary,
  };
}

async function grant(learnerId: string, tenantId: string, programId: string) {
  const id = "enrollment-" + randomUUID();
  await getFirestore(app!).collection("commerceEnrollments").doc(id).set({
    enrollmentId: id, entitlementId: "entitlement-" + id,
    learnerId, tenantId, programId,
    productId: "product-" + id, customerId: "customer-" + id,
    status: "active", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    lastProvider: "hotmart", lastProviderEventId: "activation-" + id,
    lastEventAt: new Date().toISOString(),
  });
  return id;
}

const onboarding = {
  goal: "communication", diagnostic: "a", confidence: 3, minutes: 12,
  createdAt: "2026-10-20T11:00:00.000Z",
};

describe.runIf(available)("LUMA-070 live Firestore emulator acceptance", () => {
  afterAll(async () => {
    if (app) await deleteApp(app);
  });

  it("keeps tenant/program learner assessments isolated and idempotent", async () => {
    const learnerId = "mariana-" + randomUUID();
    const storeA = new FirestoreLearningStore(getFirestore(app!), {
      tenantId: "institution-a", programId: "program-practitioner",
    });
    const storeB = new FirestoreLearningStore(getFirestore(app!), {
      tenantId: "institution-a", programId: "program-advanced",
    });
    const approved = await publishTestAssessment({ tenantId: "institution-a", programId: "program-practitioner" });
    const grantA = await grant(learnerId, "institution-a", "program-practitioner");
    await grant(learnerId, "institution-a", "program-advanced");
    await storeA.bootstrap(learnerId, onboarding);
    await storeB.bootstrap(learnerId, { ...onboarding, goal: "beliefs" });

    const result = await storeA.appendEvent(learnerId, "entry-" + randomUUID(), newEvent(approved));
    expect(result.duplicate).toBe(false);
    expect(result.record.entryAssessmentActive).toBe(true);
    expect(result.record.entryAssessment?.twinAuthority).toBe("none");
    expect(result.plan.nextAction.id).toMatch(/^program-entry-/);

    const replay = await storeA.appendEvent(learnerId, result.record.lastEventId!, newEvent(approved));
    expect(replay.duplicate).toBe(true);
    expect(replay.record.version).toBe(2);
    expect((await storeB.get(learnerId))?.record.entryAssessment).toBeUndefined();
    expect((await storeB.get(learnerId))?.record.version).toBe(1);

    await expect(storeA.appendEvent(learnerId, "another-" + randomUUID(), newEvent(approved)))
      .rejects.toThrow("ENTRY_ASSESSMENT_RECENTLY_COMPLETED");

    // Effective commerce entitlement must still be checked inside the transaction.
    await getFirestore(app!).collection("commerceEnrollments").doc(grantA).update({ status: "revoked" });
    await expect(storeA.appendEvent(learnerId, "denied-" + randomUUID(), newEvent(approved)))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    expect((await storeA.get(learnerId))?.record.version).toBe(2);
  });

  it("blocks a new event when approval or publication is withdrawn, inside the transaction", async () => {
    const scope = { tenantId: "institution-revocation", programId: "program-a" };
    const uid = "revoked-" + randomUUID();
    const approved = await publishTestAssessment(scope);
    await grant(uid, scope.tenantId, scope.programId);
    const store = new FirestoreLearningStore(getFirestore(app!), scope);
    await store.bootstrap(uid, onboarding);
    const paths = assessmentCatalogPaths(scope);
    await getFirestore(app!).doc(paths.pointer).update({ status: "draft" });
    await expect(store.appendEvent(uid, "revoked-" + randomUUID(), newEvent(approved)))
      .rejects.toThrow("ASSESSMENT_REGISTRY_CHANGED");
    await getFirestore(app!).doc(paths.pointer).update({ status: "published" });
    await getFirestore(app!).collection("programOfferings").doc(approved.offeringId).update({ status: "draft" });
    await expect(store.appendEvent(uid, "unpublished-" + randomUUID(), newEvent(approved)))
      .rejects.toThrow("ASSESSMENT_REGISTRY_CHANGED");
    expect((await store.get(uid))?.record.version).toBe(1);
    expect(await store.listEvents(uid)).toHaveLength(0);
  });

  it("serializes simultaneous submissions and never allows two distinct assessment events", async () => {
    const uid = "abigail-" + randomUUID();
    const approved = await publishTestAssessment({ tenantId: "institution-concurrent", programId: "program-a" });
    await grant(uid, "institution-concurrent", "program-a");
    const store = new FirestoreLearningStore(getFirestore(app!), {
      tenantId: "institution-concurrent", programId: "program-a",
    });
    await store.bootstrap(uid, onboarding);
    const results = await Promise.allSettled([
      store.appendEvent(uid, "concurrent-a-" + randomUUID(), newEvent(approved)),
      store.appendEvent(uid, "concurrent-b-" + randomUUID(), newEvent(approved)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const stored = await store.get(uid);
    expect(stored?.record.version).toBe(2);
    expect(await store.listEvents(uid)).toHaveLength(1);
  });
});
