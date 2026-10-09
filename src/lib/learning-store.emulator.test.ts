import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreLearningStore } from "./learning-store";
import { createPersistentLearnerRecord } from "./persistent-learning";

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const app = emulatorEnabled
  ? initializeApp(
      { projectId: process.env.GCLOUD_PROJECT || "demo-luma-persistent-twin" },
      `luma-learning-store-${randomUUID()}`,
    )
  : undefined;
const store = app ? new FirestoreLearningStore(getFirestore(app)) : undefined;

describe.runIf(emulatorEnabled)("FirestoreLearningStore emulator", () => {
  afterAll(async () => {
    if (app) await deleteApp(app);
  });

  it("keeps bootstrap and event replay idempotent and preserves route change after reload", async () => {
    const learnerId = `learner-${randomUUID()}`;
    const eventId = `event-${randomUUID()}`;
    const onboarding = {
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 12,
      createdAt: "2026-10-05T15:00:00.000Z",
    };

    const bootstrapped = await store!.bootstrap(learnerId, onboarding);
    const bootstrapRetry = await store!.bootstrap(learnerId, onboarding);

    const event = {
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      correctCount: 3,
      answers: { thought: "pas", emotion: "shame", reframe: "balanced" },
      attempts: { thought: 1, emotion: 1, reframe: 1 },
      completedAt: "2026-10-05T15:05:00.000Z",
    };

    const first = await store!.appendEvent(learnerId, eventId, event);
    const replay = await store!.appendEvent(learnerId, eventId, event);
    const reloaded = await store!.get(learnerId);

    expect(bootstrapped.record.version).toBe(1);
    expect(bootstrapRetry.duplicate).toBe(true);
    expect(bootstrapRetry.record.version).toBe(1);

    expect(first.duplicate).toBe(false);
    expect(first.record.version).toBe(2);
    expect(first.plan.routeChanged).toBe(true);
    expect(first.record.previousAction?.id).toBe(bootstrapped.plan.nextAction.id);

    expect(replay.duplicate).toBe(true);
    expect(replay.record.version).toBe(2);
    expect(replay.record.lastEventId).toBe(eventId);

    expect(reloaded?.plan.routeChanged).toBe(true);
    expect(reloaded?.plan.previousAction?.id).toBe(bootstrapped.plan.nextAction.id);

    const persistedEvent = await getFirestore(app!)
      .collection("learners")
      .doc(learnerId)
      .collection("events")
      .doc(eventId)
      .get();
    expect(persistedEvent.exists).toBe(true);
    expect(persistedEvent.data()?.journeyId).toBe(bootstrapped.record.journeyId);
  });

  it("paginates the full cohort so oldest learners are not dropped", async () => {
    const firestore = getFirestore(app!);
    const before = await store!.listAll(25);
    const suffix = randomUUID();
    const batch = firestore.batch();

    for (let index = 0; index < 105; index += 1) {
      const learnerId = `bulk-${suffix}-${String(index).padStart(3, "0")}`;
      const createdAt = new Date(
        Date.UTC(2026, 0, 1, 0, index, 0),
      ).toISOString();
      const generated = createPersistentLearnerRecord(learnerId, {
        goal: "emotions",
        diagnostic: "b",
        confidence: 2,
        minutes: 12,
        createdAt,
      });
      batch.set(firestore.collection("learners").doc(learnerId), {
        ...generated.record,
        updatedAt: createdAt,
      });
    }
    await batch.commit();

    const all = await store!.listAll(25);
    expect(all.length).toBe(before.length + 105);
    expect(
      all.some((item) => item.record.learnerId === `bulk-${suffix}-000`),
    ).toBe(true);
    expect(
      all.some((item) => item.record.learnerId === `bulk-${suffix}-104`),
    ).toBe(true);
  });

  it("keeps same Firebase UID fully separate across tenants and programs", async () => {
    const uid = `shared-uid-${randomUUID()}`;
    const storeA = new FirestoreLearningStore(getFirestore(app!), {
      tenantId: "tenant-a", programId: "course-1",
    });
    const storeB = new FirestoreLearningStore(getFirestore(app!), {
      tenantId: "tenant-a", programId: "course-2",
    });
    const storeC = new FirestoreLearningStore(getFirestore(app!), {
      tenantId: "tenant-b", programId: "course-1",
    });
    // The strict-mode store requires effective enrollment inside each write
    // transaction. Store three independent purchases for the same UID.
    const firestore = getFirestore(app!);
    const enrolled = [
      { tenantId: "tenant-a", programId: "course-1" },
      { tenantId: "tenant-a", programId: "course-2" },
      { tenantId: "tenant-b", programId: "course-1" },
    ];
    for (const [index, scope] of enrolled.entries()) {
      await firestore.collection("commerceEnrollments")
        .doc(`scoped-${uid}-${index}`).set({
          enrollmentId: `scoped-${uid}-${index}`,
          entitlementId: `entitlement-${uid}-${index}`,
          ...scope,
          learnerId: uid,
          productId: `product-${index}`,
          customerId: `customer-${uid}`,
          status: "active",
          createdAt: "2026-10-06T15:00:00Z",
          updatedAt: "2026-10-06T15:00:00Z",
          lastProvider: "hotmart",
          lastProviderEventId: `event-${index}`,
          lastEventAt: "2026-10-06T15:00:00Z",
        });
    }
    const onboarding = {
      diagnostic: "b" as const, confidence: 2 as const,
      minutes: 12 as const, createdAt: "2026-10-06T15:00:00Z",
    };
    await storeA.bootstrap(uid, { ...onboarding, goal: "emotions" });
    await storeB.bootstrap(uid, { ...onboarding, goal: "communication" });
    await storeC.bootstrap(uid, { ...onboarding, goal: "beliefs" });

    expect((await storeA.get(uid))?.record.onboarding.goal).toBe("emotions");
    expect((await storeB.get(uid))?.record.onboarding.goal).toBe("communication");
    expect((await storeC.get(uid))?.record.onboarding.goal).toBe("beliefs");
    expect(await store!.get(uid)).toBeUndefined();

    const event = {
      type: "SIMULATION_COMPLETED" as const, conceptId: "pas",
      correctCount: 3,
      answers: { thought: "pas", emotion: "shame", reframe: "balanced" },
      attempts: { thought: 1, emotion: 1, reframe: 1 },
      completedAt: "2026-10-06T15:10:00Z",
    };
    await storeA.appendEvent(uid, "shared-event-id", event);
    await storeB.appendEvent(uid, "shared-event-id", event);
    expect((await storeA.get(uid))?.record.version).toBe(2);
    expect((await storeB.get(uid))?.record.version).toBe(2);
    expect((await storeC.get(uid))?.record.version).toBe(1);
    expect((await storeC.listEvents(uid)).length).toBe(0);
    // An effective revocation after earlier learner authorization is checked
    // again inside the Firestore write transaction, including event replays.
    await firestore.collection("commerceEnrollments")
      .doc(`scoped-${uid}-0`).update({ status: "revoked" });
    await expect(storeA.appendEvent(uid, "after-revocation", event))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    await expect(storeA.appendEvent(uid, "shared-event-id", event))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    await expect(storeA.bootstrap(uid, { ...onboarding, goal: "emotions" }))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    expect((await storeA.get(uid))?.record.version).toBe(2);
    expect((await storeA.listEvents(uid)).length).toBe(1);
    expect((await storeB.get(uid))?.record.version).toBe(2);
    expect((await storeA.list(10)).some(({ record }) => record.learnerId === uid)).toBe(true);
    expect((await storeC.list(10)).some(({ record }) => record.learnerId === uid)).toBe(true);
  });

  it("isolates learners in distinct document trees", async () => {
    const learnerA = `learner-a-${randomUUID()}`;
    const learnerB = `learner-b-${randomUUID()}`;

    await store!.bootstrap(learnerA, {
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 8,
      createdAt: "2026-10-05T15:10:00.000Z",
    });
    await store!.bootstrap(learnerB, {
      goal: "communication",
      diagnostic: "a",
      confidence: 4,
      minutes: 35,
      createdAt: "2026-10-05T15:11:00.000Z",
    });

    const [a, b] = await Promise.all([store!.get(learnerA), store!.get(learnerB)]);
    expect(a?.record.learnerId).toBe(learnerA);
    expect(b?.record.learnerId).toBe(learnerB);
    expect(a?.plan.nextAction.id).not.toBe(b?.plan.nextAction.id);
  });
});
