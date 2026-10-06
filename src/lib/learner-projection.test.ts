import { describe, expect, it } from "vitest";
import { createAdaptiveLearningPlan } from "./learner-projection";

const successfulPasEvent = {
  type: "SIMULATION_COMPLETED",
  conceptId: "pas",
  correctCount: 3,
  attempts: { thought: 1, emotion: 1, reframe: 1 },
  completedAt: "2026-10-05T15:00:00.000Z",
};

describe("learner projection", () => {
  it("uses goal and available time to produce materially different next actions", () => {
    const emotions = createAdaptiveLearningPlan({
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 8,
    });
    const communication = createAdaptiveLearningPlan({
      goal: "communication",
      diagnostic: "a",
      confidence: 2,
      minutes: 35,
    });

    expect(emotions.state.goal).toBe("Gestionar mejor mis emociones");
    expect(emotions.state.availableMinutes).toBe(8);
    expect(emotions.nextAction.conceptId).toBe("pas");

    expect(communication.state.goal).toBe("Comunicarme con más claridad");
    expect(communication.state.availableMinutes).toBe(35);
    expect(communication.nextAction.id).toBe("communication-congruence-practice");

    expect(emotions.nextAction.id).not.toBe(communication.nextAction.id);
  });

  it("uses successful evidence to change the route instead of repeating the same practice", () => {
    const onboarding = {
      goal: "emotions",
      diagnostic: "b",
      confidence: 2,
      minutes: 12,
    };

    const before = createAdaptiveLearningPlan(onboarding);
    const after = createAdaptiveLearningPlan(onboarding, successfulPasEvent);

    expect(before.nextAction.conceptId).toBe("pas");
    expect(after.routeChanged).toBe(true);
    expect(after.previousAction?.id).toBe(before.nextAction.id);
    expect(after.nextAction.id).not.toBe(before.nextAction.id);
    expect(after.state.concepts.find((item) => item.conceptId === "pas")?.mastery).toBeGreaterThanOrEqual(0.88);
  });

  it("does not treat a wrong diagnostic as mastery for a beliefs goal", () => {
    const plan = createAdaptiveLearningPlan({
      goal: "beliefs",
      diagnostic: "a",
      confidence: 4,
      minutes: 20,
    });

    const pas = plan.state.concepts.find((item) => item.conceptId === "pas");
    expect(pas?.mastery).toBeLessThan(0.58);
    expect(plan.nextAction.id).not.toBe("beliefs-mini-simulation");
  });
});
