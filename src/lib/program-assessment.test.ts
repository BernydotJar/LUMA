import { describe, expect, it } from "vitest";
import { classContracts } from "./class-contract";
import {
  entryAssessmentNextAction,
  evaluateProgramEntryAssessment,
  getProgramEntryQuestions,
  PROGRAM_ENTRY_ASSESSMENT_VERSION,
} from "./program-assessment";
import { applyEventToPersistentLearner, createPersistentLearnerRecord } from "./persistent-learning";

const correctAnswers = Object.fromEntries(getProgramEntryQuestions().map((question) => {
  const contract = classContracts.find((item) => item.experienceSlug === question.slug);
  return [question.slug, contract?.diagnostic.choices.find((choice) => choice.correct)?.id];
})) as Record<string, string>;

describe("LUMA-070 authoritative entry assessment", () => {
  it("exposes five practical questions without answer keys or correctness", () => {
    const questions = getProgramEntryQuestions();
    expect(questions).toHaveLength(5);
    expect(JSON.stringify(questions)).not.toContain('"correct"');
    expect(JSON.stringify(questions)).not.toContain('"feedback"');
    expect(new Set(questions.map((item) => item.slug)).size).toBe(5);
  });

  it("recomputes correct answers on the server, never accepting client mastery", () => {
    const summary = evaluateProgramEntryAssessment(correctAnswers, "2026-10-20T11:35:00.000Z");
    expect(summary?.correct).toBe(5);
    expect(summary?.recommendedSlug).toBe("niveles-logicos-donde-intervenir");
    expect(summary?.evidenceCategory).toBe("observed");
    expect(summary?.twinAuthority).toBe("none");
    expect(summary?.version).toBe(PROGRAM_ENTRY_ASSESSMENT_VERSION);
  });

  it("prioritizes the earliest gap as a concrete existing class", () => {
    const first = getProgramEntryQuestions()[0];
    const wrong = first.choices.find((c) => c.id !== correctAnswers[first.slug]);
    const summary = evaluateProgramEntryAssessment({ ...correctAnswers, [first.slug]: wrong!.id });
    expect(summary?.correct).toBe(4);
    expect(summary?.needsPractice).toEqual([first.slug]);
    expect(entryAssessmentNextAction(summary!)?.href).toBe("/learn/experience/" + first.slug);
  });

  it("rejects partial, extra, out-of-catalog, and malformed selections", () => {
    expect(evaluateProgramEntryAssessment({})).toBeUndefined();
    expect(evaluateProgramEntryAssessment({ ...correctAnswers, injected: "b" })).toBeUndefined();
    expect(evaluateProgramEntryAssessment({ ...correctAnswers, [getProgramEntryQuestions()[0].slug]: "admin" })).toBeUndefined();
    expect(evaluateProgramEntryAssessment([])).toBeUndefined();
  });

  it("persists a provisional route but does not change mastery, evidence or learner identity", () => {
    const initial = createPersistentLearnerRecord("mariana", {
      goal: "communication", diagnostic: "a", confidence: 3, minutes: 12,
      createdAt: "2026-10-20T11:00:00.000Z",
    });
    const summary = evaluateProgramEntryAssessment({
      ...correctAnswers,
      [getProgramEntryQuestions()[0].slug]: "a",
    })!;
    const after = applyEventToPersistentLearner(initial.record, "entry-1", {
      type: "PROGRAM_ENTRY_ASSESSMENT_COMPLETED",
      evidenceCategory: "observed",
      twinAuthority: "none",
      programAssessment: summary,
    });
    expect(after.record.state.concepts).toEqual(initial.record.state.concepts);
    expect(after.record.learnerId).toBe("mariana");
    expect(after.record.entryAssessment).toEqual(summary);
    expect(after.record.entryAssessmentActive).toBe(true);
    expect(after.plan.entryAssessment).toEqual(summary);
    expect(after.plan.nextAction.href).toBe("/learn/experience/" + summary.recommendedSlug);
  });

  it("returns to evidence-based planning after a later scored simulation", () => {
    const initial = createPersistentLearnerRecord("mariana", {
      goal: "emotions", diagnostic: "b", confidence: 3, minutes: 12,
      createdAt: "2026-10-20T11:00:00.000Z",
    });
    const summary = evaluateProgramEntryAssessment(correctAnswers)!;
    const routed = applyEventToPersistentLearner(initial.record, "entry-1", {
      type: "PROGRAM_ENTRY_ASSESSMENT_COMPLETED", programAssessment: summary,
    });
    const practiced = applyEventToPersistentLearner(routed.record, "scored-1", {
      type: "SIMULATION_COMPLETED", conceptId: "pas",
      correctCount: 3, answers: { thought: "pas", emotion: "shame", reframe: "balanced" },
      evidenceCategory: "scored", twinAuthority: "eligible",
    });
    expect(practiced.record.entryAssessment).toEqual(summary);
    expect(practiced.record.entryAssessmentActive).toBe(false);
    expect(practiced.plan.nextAction.id).not.toMatch(/^program-entry-/);
  });
});
