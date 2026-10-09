import { describe, expect, it } from "vitest";
import { deriveCoachDataStatus } from "./coach-data-status";

describe("coach dashboard completeness", () => {
  it("waits for a snapshot", () => {
    expect(deriveCoachDataStatus(null)).toBe("loading");
  });

  it("does not claim partial data when both APIs deny access", () => {
    expect(deriveCoachDataStatus({ error: false })).toBe("unavailable");
  });

  it("does not claim partial data when both APIs fail", () => {
    expect(deriveCoachDataStatus({ error: true })).toBe("unavailable");
  });

  it("distinguishes a real empty queue from an API failure", () => {
    expect(deriveCoachDataStatus({
      learners: [], interventions: [], error: false,
    })).toBe("ready");
    expect(deriveCoachDataStatus({
      learners: [], error: true,
    })).toBe("partial");
    expect(deriveCoachDataStatus({
      interventions: [], error: true,
    })).toBe("partial");
  });

  it("does not interpret denied intervention access as an empty queue", () => {
    expect(deriveCoachDataStatus({ learners: [], error: false })).toBe("partial");
    expect(deriveCoachDataStatus({ interventions: [], error: false })).toBe("partial");
  });

  it("preserves partial status when one API succeeds and another fails", () => {
    expect(deriveCoachDataStatus({
      learners: [{ learnerId: "learner-1" }],
      interventions: undefined,
      error: true,
    })).toBe("partial");
  });
});
