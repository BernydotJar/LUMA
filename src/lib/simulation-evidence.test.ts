import { describe, expect, it } from "vitest";
import { evaluatePasSimulation, evidenceMayUpdateTwin } from "./simulation-evidence";

describe("simulation evidence", () => {
  it("creates an inspectable criterion receipt for P.A.S.", () => {
    const receipt = evaluatePasSimulation(
      { thought: "pas", emotion: "shame", reframe: "balanced" },
      { thought: 2, emotion: 1, reframe: 1 },
    );

    expect(receipt).toMatchObject({
      rubricId: "pas-v1",
      evidenceCategory: "scored",
      twinAuthority: "eligible",
      passedCriteria: 3,
      totalCriteria: 3,
      passed: true,
    });
    expect(receipt.criteria[0]).toMatchObject({
      id: "event-vs-interpretation",
      passed: true,
      attempts: 2,
    });
  });

  it("does not grant authority to self-report or diagnostics", () => {
    expect(
      evidenceMayUpdateTwin({
        type: "PRACTICE_REFLECTION_RECORDED",
        evidenceCategory: "self-reported",
        twinAuthority: "supporting",
      }),
    ).toBe(false);
    expect(
      evidenceMayUpdateTwin({
        type: "CLASS_DIAGNOSTIC_COMPLETED",
        evidenceCategory: "observed",
        twinAuthority: "none",
      }),
    ).toBe(false);
  });

  it("preserves compatibility with existing validated simulation receipts", () => {
    expect(evidenceMayUpdateTwin({ type: "SIMULATION_COMPLETED" })).toBe(true);
  });
});
