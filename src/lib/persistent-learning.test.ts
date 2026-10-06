import { describe, expect, it } from "vitest";
import {
  applyEventToPersistentLearner,
  createPersistentLearnerRecord,
  verifyLearningEvent,
} from "./persistent-learning";

const onboarding = {
  goal: "emotions",
  diagnostic: "b",
  confidence: 2,
  minutes: 12,
  createdAt: "2026-10-05T15:00:00.000Z",
};

describe("persistent learner state", () => {
  it("materializes a learner-specific state and next action from onboarding", () => {
    const result = createPersistentLearnerRecord(
      "learner-a",
      onboarding,
      "2026-10-05T15:00:01.000Z",
    );

    expect(result.record.learnerId).toBe("learner-a");
    expect(result.record.journeyId).toBe(onboarding.createdAt);
    expect(result.record.version).toBe(1);
    expect(result.record.state.learnerId).toBe("learner-a");
    expect(result.record.nextActionId).toBe(result.plan.nextAction.id);
    expect(result.record.previousAction).toBeNull();
  });

  it("increments state version and persists the action that evidence replaced", () => {
    const initial = createPersistentLearnerRecord(
      "learner-a",
      onboarding,
      "2026-10-05T15:00:01.000Z",
    );
    const applied = applyEventToPersistentLearner(
      initial.record,
      "evt-pas-001",
      {
        type: "SIMULATION_COMPLETED",
        conceptId: "pas",
        correctCount: 3,
        answers: { thought: "pas", emotion: "shame", reframe: "balanced" },
        attempts: { thought: 1, emotion: 1, reframe: 1 },
        completedAt: "2026-10-05T15:05:00.000Z",
      },
      "2026-10-05T15:05:01.000Z",
    );

    expect(applied.record.version).toBe(2);
    expect(applied.record.lastEventId).toBe("evt-pas-001");
    expect(applied.plan.routeChanged).toBe(true);
    expect(applied.plan.previousAction?.id).toBe(initial.plan.nextAction.id);
    expect(applied.record.previousAction?.id).toBe(initial.plan.nextAction.id);
    expect(applied.plan.nextAction.id).not.toBe(initial.plan.nextAction.id);
    expect(
      applied.record.state.concepts.find((concept) => concept.conceptId === "pas")?.mastery,
    ).toBeGreaterThanOrEqual(0.88);
  });

  it("recomputes scored evidence instead of trusting a forged correctCount", () => {
    const verified = verifyLearningEvent({
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      correctCount: 3,
      answers: { thought: "specific", emotion: "anger", reframe: "positive" },
    });

    expect(verified?.correctCount).toBe(0);
  });

  it("sanitizes attempt telemetry before it reaches the ledger", () => {
    const verified = verifyLearningEvent({
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      answers: { thought: "pas", emotion: "shame", reframe: "balanced" },
      attempts: {
        thought: 1,
        emotion: "2",
        reframe: 999,
        injected: 4,
      },
    });

    expect(verified?.attempts).toEqual({ thought: 1, emotion: 2 });
  });

  it("keeps two learner records isolated", () => {
    const learnerA = createPersistentLearnerRecord("learner-a", onboarding);
    const learnerB = createPersistentLearnerRecord("learner-b", {
      ...onboarding,
      goal: "communication",
      diagnostic: "a",
      minutes: 35,
    });

    expect(learnerA.record.learnerId).not.toBe(learnerB.record.learnerId);
    expect(learnerA.plan.nextAction.id).not.toBe(learnerB.plan.nextAction.id);
  });
});
