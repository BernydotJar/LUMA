import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreLearningStore } from "./learning-store";

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

  it("persists the materialized learner state and event ledger idempotently", async () => {
    const learnerId = `learner-${randomUUID()}`;
    const eventId = `event-${randomUUID()}`;
    const bootstrapped = await store!.bootstrap(learnerId, {
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 12,
      createdAt: "2026-10-05T15:00:00.000Z",
    });

    const event = {
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      correctCount: 3,
      attempts: { thought: 1, emotion: 1, reframe: 1 },
      completedAt: "2026-10-05T15:05:00.000Z",
    };

    const first = await store!.appendEvent(learnerId, eventId, event);
    const replay = await store!.appendEvent(learnerId, eventId, event);

    expect(bootstrapped.record.version).toBe(1);
    expect(first.duplicate).toBe(false);
    expect(first.record.version).toBe(2);
    expect(first.plan.routeChanged).toBe(true);
    expect(replay.duplicate).toBe(true);
    expect(replay.record.version).toBe(2);
    expect(replay.record.lastEventId).toBe(eventId);

    const persistedEvent = await getFirestore(app!)
      .collection("learners")
      .doc(learnerId)
      .collection("events")
      .doc(eventId)
      .get();
    expect(persistedEvent.exists).toBe(true);
    expect(persistedEvent.data()?.journeyId).toBe(bootstrapped.record.journeyId);
  });

  it("isolates learners in distinct document trees", async () => {
    const learnerA = `learner-a-${randomUUID()}`;
    const learnerB = `learner-b-${randomUUID()}`;

    await store!.bootstrap(learnerA, {
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 8,
    });
    await store!.bootstrap(learnerB, {
      goal: "communication",
      diagnostic: "a",
      confidence: 4,
      minutes: 35,
    });

    const [a, b] = await Promise.all([store!.get(learnerA), store!.get(learnerB)]);
    expect(a?.record.learnerId).toBe(learnerA);
    expect(b?.record.learnerId).toBe(learnerB);
    expect(a?.plan.nextAction.id).not.toBe(b?.plan.nextAction.id);
  });
});
