import { describe, expect, it } from "vitest";
import {
  classContracts,
  validateClassContract,
  validatePublishedClassCoverage,
} from "./class-contract";

describe("pedagogy as code", () => {
  it("every published learning experience has a valid class contract", () => {
    const result = validatePublishedClassCoverage();
    expect(result.findings).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it("prevents self-reported evidence from independently updating mastery", () => {
    const base = classContracts.find(
      (contract) => contract.experienceSlug === "congruencia-tres-canales",
    );
    expect(base).toBeDefined();

    const invalid = {
      ...base!,
      evidenceContract: {
        ...base!.evidenceContract,
        twinAuthority: "eligible" as const,
      },
    };

    const result = validateClassContract(invalid);
    expect(result.pass).toBe(false);
    expect(result.findings.some((finding) => finding.code === "SELF_REPORT_MASTERY")).toBe(true);
  });

  it("requires a rubric for scored evidence", () => {
    const base = classContracts.find(
      (contract) => contract.experienceSlug === "pas-detectar-y-reformular",
    );
    expect(base).toBeDefined();

    const invalid = { ...base!, rubric: undefined };
    const result = validateClassContract(invalid);

    expect(result.pass).toBe(false);
    expect(result.findings.some((finding) => finding.code === "SCORED_WITHOUT_RUBRIC")).toBe(true);
  });

  it("requires a delayed recheck rather than same-session mastery", () => {
    const invalid = {
      ...classContracts[0],
      deferredRecheck: {
        ...classContracts[0].deferredRecheck,
        delayHours: 2,
      },
    };

    const result = validateClassContract(invalid);

    expect(result.pass).toBe(false);
    expect(result.findings.some((finding) => finding.code === "RECHECK_TOO_SOON")).toBe(true);
  });
});
