import { describe, expect, it } from "vitest";
import { evaluateTwinPilot, type PilotEvidenceBundle, type AssessmentReceipt } from "./pilot-evaluation";

const protocol = {
  pilotId: "p0-pas-2026", tenantId: "institution-a", programId: "program-pas",
  teacherUid: "teacher-1", rubricId: "rubric-pas", rubricVersion: "v1",
  criterionIds: ["identify", "contrast", "apply", "transfer"],
  maxCostPerLearnerUsd: 5, minPerArm: 5,
  minPairedRate: 0.8, minDifferentialGain: 0.1,
  minFollowupRate: 0.8, maxHumanResponseHours: 24,
};

function fixture(tier: PilotEvidenceBundle["tier"] = "synthetic"): PilotEvidenceBundle {
  const assignments: PilotEvidenceBundle["assignments"] = [];
  const assessments: AssessmentReceipt[] = [];
  const criteria = (count: number): Record<string, boolean> =>
    Object.fromEntries(protocol.criterionIds.map((name, i) => [name, i < count]));
  for (let i = 0; i < 10; i++) {
    const learnerId = `synthetic-${i}`;
    const arm = i < 5 ? "twin_assisted" : "standard_support";
    assignments.push({ learnerId, arm, assignmentReceiptId: `assignment-${i}` });
    const make = (phase: AssessmentReceipt["phase"], count: number, day: string): AssessmentReceipt => ({
      tenantId: protocol.tenantId, programId: protocol.programId,
      learnerId, arm, phase,
      rubricId: protocol.rubricId, rubricVersion: protocol.rubricVersion,
      criteria: criteria(count), sourceEventId: `source-${i}-${phase}`,
      assessorUid: "blind-rater", blindScored: true,
      occurredAt: `2026-10-${day}T12:00:00Z`,
    });
    assessments.push(make("baseline", 2, "01"));
    assessments.push(make("post", arm === "twin_assisted" ? 4 : 3, "10"));
    assessments.push(make("retention", arm === "twin_assisted" ? 4 : 3, "15"));
  }
  return {
    tier, protocol, assignments, assessments,
    interventions: [0, 1].map((i) => ({
      tenantId: "institution-a", programId: "program-pas",
      learnerId: `synthetic-${i}`, reasonEvidenceId: `source-${i}-post`,
      proposedAt: "2026-10-11T11:00:00Z", respondedAt: "2026-10-11T12:00:00Z",
      teacherUid: "teacher-1", outcome: "completed",
      followUpEventId: `source-${i}-retention`,
    })),
    usage: [{ provider: "ollama", model: "gemma4", inputTokens: 1000,
      outputTokens: 300, inputUsdPerMillion: 0, outputUsdPerMillion: 0,
      billedUsd: 2, billingVerified: true, receiptId: "invoice-1" }],
    infrastructureCostUsd: 2, teacherMinutes: 20, teacherHourlyCostUsd: 18,
    activeLearners: 10, independentReviewerId: "reviewer-2",
    independentReviewReceiptId: "reviewer-receipt-1",
    isolation: { evidenceId: "emulator-run-1", negativeTenantRead: true,
      negativeProgramRead: true, negativeCrossTenantWrite: true,
      negativeCrossProgramWrite: true, scopedRagSourceFiltering: true },
  };
}

describe("LUMA Twin Intelligence P0 evaluation", () => {
  it("calculates illustrative paired gains while refusing synthetic GO", () => {
    const report = evaluateTwinPilot(fixture());
    expect(report.meanGain.twinAssisted).toBe(0.5);
    expect(report.meanGain.standardSupport).toBe(0.25);
    expect(report.differentialGain).toBe(0.25);
    expect(report.responseWithinSlaRate).toBe(1);
    expect(report.followupRate).toBe(1);
    expect(report.costPerActiveLearnerUsd).toBe(1);
    expect(report.gates.every((g) => g.status === "PENDING")).toBe(true);
    expect(report.releaseDecision).toBe("PENDING_REAL_PILOT");
  });
  it("marks complete verified bundle only as an EXIT CANDIDATE, never as production authorization", () => {
    const r = evaluateTwinPilot(fixture("verified_pilot"));
    expect(r.releaseDecision).toBe("PILOT_EXIT_CANDIDATE");
    expect(r.findings.join(" ")).toMatch(/NO constituye autorización de producción/);
  });
  it("fails closed when tenant/program leaks or rubric changes", () => {
    const a = fixture();
    a.assessments[0].tenantId = "other-tenant";
    expect(() => evaluateTwinPilot(a)).toThrow(/INTEGRITY/);
    const b = fixture();
    b.assessments[0].rubricVersion = "fake-v2";
    expect(() => evaluateTwinPilot(b)).toThrow(/INTEGRITY/);
    const c = fixture();
    c.interventions[0].programId = "other-program";
    expect(() => evaluateTwinPilot(c)).toThrow(/INTEGRITY/);
  });
  it("rejects duplicated source events and reassigned learners", () => {
    const a = fixture();
    a.assessments[1].sourceEventId = a.assessments[0].sourceEventId;
    expect(() => evaluateTwinPilot(a)).toThrow(/DUPLICATE/);
    const b = fixture();
    b.assignments[0].arm = "standard_support";
    expect(() => evaluateTwinPilot(b)).toThrow(/ARM_CHANGED/);
  });
  it("retains dropout in the cohort denominator", () => {
    const a = fixture("verified_pilot");
    a.assessments = a.assessments.filter((v) =>
      !(v.learnerId === "synthetic-2" && v.phase === "post"));
    const r = evaluateTwinPilot(a);
    expect(r.releaseDecision).toBe("PENDING_REAL_PILOT");
    expect(r.gates.find((g) => g.id === "EDUCATIONAL_GAIN")?.status).toBe("PENDING");
  });
  it("cannot claim effectiveness solely from a model response or an unverified cost estimate", () => {
    const a = fixture("verified_pilot");
    a.interventions = [];
    a.usage[0].billingVerified = false;
    const r = evaluateTwinPilot(a);
    expect(r.gates.find((g) => g.id === "HUMAN_INTERVENTION")?.status).toBe("PENDING");
    expect(r.gates.find((g) => g.id === "UNIT_ECONOMICS")?.status).toBe("PENDING");
    expect(r.releaseDecision).toBe("PENDING_REAL_PILOT");
  });
  it("rejects post-test recorded before baseline", () => {
    const a = fixture();
    const result = a.assessments.find((x) =>
      x.learnerId === "synthetic-0" && x.phase === "post")!;
    result.occurredAt = "2026-09-01T12:00:00Z";
    expect(() => evaluateTwinPilot(a)).toThrow(/PHASE_ORDER/);
  });
  it("requires a separate reviewer for verified evidence gate", () => {
    const a = fixture("verified_pilot");
    a.independentReviewerId = a.protocol.teacherUid;
    const r = evaluateTwinPilot(a);
    expect(r.gates.find((g) => g.id === "EVIDENCE_INTEGRITY")?.status).toBe("PENDING");
  });
});
