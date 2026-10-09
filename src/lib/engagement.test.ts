import { describe, expect, it } from "vitest";
import { evaluateLearnerEngagement } from "./engagement";
import type { PersistedLearnerRecord } from "./persistent-learning";

function record(overrides: Partial<PersistedLearnerRecord> = {}): PersistedLearnerRecord {
  return {
    schemaVersion: 1,
    learnerId: "learner-1",
    journeyId: "journey-1",
    onboarding: {
      goal: "emotions",
      diagnostic: "b",
      confidence: 3,
      minutes: 20,
      createdAt: "2026-09-01T00:00:00Z",
    },
    state: {
      learnerId: "learner-1",
      goal: "Gestionar mejor mis emociones",
      availableMinutes: 20,
      focusConceptIds: ["pas"],
      concepts: [
        {
          conceptId: "pas",
          label: "P.A.S.",
          prerequisiteIds: [],
          mastery: 0.3,
          confidence: 0.4,
          attempts: 4,
          consecutiveFailures: 3,
          completedContent: false,
        },
        {
          conceptId: "beliefs",
          label: "Creencias",
          prerequisiteIds: ["pas"],
          mastery: 0.4,
          confidence: 0.5,
          attempts: 1,
          consecutiveFailures: 0,
          completedContent: false,
        },
      ],
    },
    nextActionId: "pas",
    previousAction: null,
    version: 3,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-20T00:00:00Z",
    ...overrides,
  };
}

describe("engagement intervention engine", () => {
  it("escalates prolonged inactivity plus low mastery to human intervention", () => {
    const signal = evaluateLearnerEngagement(
      record(),
      "2026-10-08T00:00:00Z",
    );
    expect(signal.priority).toBe("high");
    expect(signal.score).toBeGreaterThanOrEqual(60);
    expect(signal.recommendation).toMatch(/Check-in humano/i);
  });

  it("avoids intrusive intervention when the learner is progressing", () => {
    const current = record({
      updatedAt: "2026-10-07T00:00:00Z",
      state: {
        ...record().state,
        concepts: record().state.concepts.map((concept) => ({
          ...concept,
          mastery: 0.86,
          consecutiveFailures: 0,
          completedContent: true,
        })),
      },
    });
    const signal = evaluateLearnerEngagement(
      current,
      "2026-10-08T00:00:00Z",
    );
    expect(signal.priority).toBe("low");
    expect(signal.score).toBe(0);
  });
});
