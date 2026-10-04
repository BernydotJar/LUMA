import { describe, expect, it } from "vitest";
import { rankLearningActions, selectNextLearningAction } from "./learning-engine";
import type { LearnerState, LearningAction } from "@/types/learning";

const action = (
  id: string,
  conceptId: string,
  kind: LearningAction["kind"],
  minutes = 8,
): LearningAction => ({
  id,
  conceptId,
  kind,
  title: id,
  description: id,
  minutes,
  sourceLabel: "Fixture",
  sourceUrl: "https://example.test/source",
  targetMastery: 0.8,
  prerequisiteIds: [],
});

const baseState = (overrides: Partial<LearnerState["concepts"][number]>): LearnerState => ({
  learnerId: "learner-a",
  goal: "Demostrar una competencia",
  availableMinutes: 12,
  concepts: [
    {
      conceptId: "beliefs",
      label: "Creencias",
      mastery: 0.5,
      confidence: 0.55,
      attempts: 1,
      consecutiveFailures: 0,
      completedContent: false,
      prerequisiteIds: [],
      ...overrides,
    },
  ],
});

describe("best next learning action", () => {
  it("does not force known material when mastery is already strong", () => {
    const state = baseState({ mastery: 0.9, confidence: 0.86, completedContent: true });
    const result = selectNextLearningAction(state, [
      action("repeat", "beliefs", "review"),
      action("advance", "beliefs", "continue"),
    ]);
    expect(result?.id).toBe("advance");
  });

  it("remediates instead of blindly advancing after repeated failure", () => {
    const state = baseState({ consecutiveFailures: 3, mastery: 0.34, confidence: 0.28 });
    const result = selectNextLearningAction(state, [
      action("advance", "beliefs", "continue"),
      action("guided-practice", "beliefs", "practice"),
    ]);
    expect(result?.id).toBe("guided-practice");
    expect(result?.reason).toContain("práctica guiada de transferencia");
  });

  it("treats content completion as different from mastery", () => {
    const state = baseState({ completedContent: true, mastery: 0.48 });
    const ranked = rankLearningActions(state, [
      action("more-video", "beliefs", "continue"),
      action("transfer-practice", "beliefs", "simulation"),
    ]);
    expect(ranked[0].id).toBe("transfer-practice");
    expect(ranked[0].reason).toContain("práctica de transferencia");
  });

  it("prefers actions that fit the learner's available time", () => {
    const state = baseState({ mastery: 0.46 });
    const ranked = rankLearningActions(state, [
      action("long", "beliefs", "practice", 35),
      action("short", "beliefs", "practice", 8),
    ]);
    expect(ranked[0].id).toBe("short");
  });
});
