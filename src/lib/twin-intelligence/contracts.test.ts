import { describe, expect, it } from "vitest";
import {
  assertPilotTeacher, assertTwinPilotScope, decideTwinLearningMove,
  methodDigest, validTeachingTwinMethod, type TeachingTwinMethod,
  type TeachingTwinRevision,
} from "./contracts";
import type { LearnerState, RankedLearningAction } from "@/types/learning";

export const method: TeachingTwinMethod = {
  title: "Metodo Socratico P.A.S.",
  objective: "Distinguir hecho, pensamiento e interpretacion",
  pedagogicalPrinciples: ["Preguntar antes de responder", "Practica con evidencia"],
  strategies: {
    explain: { instruction: "Mostrar un ejemplo autorizado", approvedSourceIds: ["m3:pas"] },
    practice: { instruction: "Ensayar un caso nuevo", approvedSourceIds: ["m3:sim"] },
    remediate: { instruction: "Contrastar evento e interpretacion", approvedSourceIds: ["m3:pas"] },
  },
  escalation: { consecutiveFailures: 2, confidenceBelow: 0.4 },
  assessment: { rubricId: "pas-rubric", rubricVersion: "1", criterionIds: ["event", "thought", "emotion"] },
};

const teacher: TeachingTwinRevision = {
  schemaVersion: 1,
  revision: 2,
  tenantId: "institution-a",
  programId: "program-pas",
  teacherUid: "teacher-1",
  method, methodSha256: methodDigest(method),
  status: "APPROVED",
  createdAt: "2026-10-27T00:00:00Z",
  approvedAt: "2026-10-27T00:01:00Z",
  approvedByUid: "teacher-1",
};

const action: RankedLearningAction = {
  id: "practice-pas", kind: "practice", conceptId: "pas", title: "P.A.S.",
  description: "Aplicar", minutes: 8, sourceLabel: "M3", sourceUrl: "https://example.test/m3",
  targetMastery: 0.8, prerequisiteIds: [], score: 0.8, reason: "Practicar transferencia",
  confidence: 0.8,
};

function learner(attempts: number, consecutiveFailures: number, confidence: number): LearnerState {
  return {
    learnerId: "student-a", goal: "communication", availableMinutes: 8,
    concepts: [{ conceptId: "pas", label: "PAS", mastery: 0.5,
      confidence, attempts, consecutiveFailures, completedContent: true,
      prerequisiteIds: [] }],
  };
}

describe("Twin Intelligence contracts", () => {
  it("requires a complete bounded teaching methodology", () => {
    expect(validTeachingTwinMethod(method)).toBe(true);
    expect(validTeachingTwinMethod({ ...method, title: "" })).toBe(false);
    expect(validTeachingTwinMethod({
      ...method, strategies: { ...method.strategies,
        explain: { instruction: "Bad", approvedSourceIds: [] } },
    })).toBe(false);
  });
  it("is disabled by default and rejects another institution", () => {
    const env = { LUMA_TWIN_PILOT_ENABLED: "true",
      LUMA_TWIN_PILOT_TENANT_ID: "institution-a",
      LUMA_TWIN_PILOT_PROGRAM_ID: "program-pas",
      LUMA_TWIN_PILOT_TEACHER_UID: "teacher-1" };
    expect(() => assertTwinPilotScope({ tenantId: "institution-a", programId: "program-pas" }, {})).toThrow();
    expect(() => assertTwinPilotScope({ tenantId: "institution-b", programId: "program-pas" }, env)).toThrow();
    expect(() => assertTwinPilotScope({ tenantId: "institution-a", programId: "other-program" }, env)).toThrow();
    expect(() => assertPilotTeacher("teacher-2", ["institution-a"],
      { tenantId: "institution-a", programId: "program-pas" }, env)).toThrow();
    expect(() => assertPilotTeacher("teacher-1", ["institution-b"],
      { tenantId: "institution-a", programId: "program-pas" }, env)).toThrow();
    expect(() => assertPilotTeacher("teacher-1", ["institution-a"],
      { tenantId: "institution-a", programId: "program-pas" }, env)).not.toThrow();
  });
  it("does not infer mastery from onboarding", () => {
    const result = decideTwinLearningMove({ learner: learner(0, 0, 0.1),
      learnerProjectionVersion: 1, action, teacher });
    expect(result.learningMove).toBe("DIAGNOSTIC");
    expect(result.requiresHumanReview).toBe(false);
    expect(result.masteryMutationAuthorized).toBe(false);
    expect(result.sourceVerification).toBe("TEACHER_DECLARED_NOT_RETRIEVAL_VERIFIED");
  });
  it("proposes educator escalation after actual repeated failure", () => {
    const result = decideTwinLearningMove({ learner: learner(3, 2, 0.35),
      learnerProjectionVersion: 3, action, teacher });
    expect(result.learningMove).toBe("ESCALATE");
    expect(result.requiresHumanReview).toBe(true);
  });
  it("does not accept an unapproved or edited methodology", () => {
    expect(() => decideTwinLearningMove({ learner: learner(2, 1, 0.6),
      learnerProjectionVersion: 2, action, teacher: { ...teacher, status: "DRAFT" } })).toThrow();
    expect(() => decideTwinLearningMove({ learner: learner(2, 1, 0.6),
      learnerProjectionVersion: 2, action, teacher: { ...teacher, method: { ...method, title: "Modified" } } })).toThrow();
  });
  it("never suggests a concept absent from the verified learner state", () => {
    expect(() => decideTwinLearningMove({ learner: learner(2, 1, 0.6),
      learnerProjectionVersion: 2, action: { ...action, conceptId: "other" }, teacher })).toThrow();
  });
});
