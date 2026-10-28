import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreLearningStore } from "./learning-store";
import { evaluateProgramEntryAssessment, getProgramEntryQuestions } from "./program-assessment";
import { getClassContract } from "./class-contract";

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

function newEvent() {
  const summary = evaluateProgramEntryAssessment(allCorrect)!;
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
    const grantA = await grant(learnerId, "institution-a", "program-practitioner");
    await grant(learnerId, "institution-a", "program-advanced");
    await storeA.bootstrap(learnerId, onboarding);
    await storeB.bootstrap(learnerId, { ...onboarding, goal: "beliefs" });

    const result = await storeA.appendEvent(learnerId, "entry-" + randomUUID(), newEvent());
    expect(result.duplicate).toBe(false);
    expect(result.record.entryAssessmentActive).toBe(true);
    expect(result.record.entryAssessment?.twinAuthority).toBe("none");
    expect(result.plan.nextAction.id).toMatch(/^program-entry-/);

    const replay = await storeA.appendEvent(learnerId, result.record.lastEventId!, newEvent());
    expect(replay.duplicate).toBe(true);
    expect(replay.record.version).toBe(2);
    expect((await storeB.get(learnerId))?.record.entryAssessment).toBeUndefined();
    expect((await storeB.get(learnerId))?.record.version).toBe(1);

    await expect(storeA.appendEvent(learnerId, "another-" + randomUUID(), newEvent()))
      .rejects.toThrow("ENTRY_ASSESSMENT_RECENTLY_COMPLETED");

    // Effective commerce entitlement must still be checked inside the transaction.
    await getFirestore(app!).collection("commerceEnrollments").doc(grantA).update({ status: "revoked" });
    await expect(storeA.appendEvent(learnerId, "denied-" + randomUUID(), newEvent()))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    expect((await storeA.get(learnerId))?.record.version).toBe(2);
  });

  it("serializes simultaneous submissions and never allows two distinct assessment events", async () => {
    const uid = "abigail-" + randomUUID();
    await grant(uid, "institution-concurrent", "program-a");
    const store = new FirestoreLearningStore(getFirestore(app!), {
      tenantId: "institution-concurrent", programId: "program-a",
    });
    await store.bootstrap(uid, onboarding);
    const results = await Promise.allSettled([
      store.appendEvent(uid, "concurrent-a-" + randomUUID(), newEvent()),
      store.appendEvent(uid, "concurrent-b-" + randomUUID(), newEvent()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const stored = await store.get(uid);
    expect(stored?.record.version).toBe(2);
    expect(await store.listEvents(uid)).toHaveLength(1);
  });
});
