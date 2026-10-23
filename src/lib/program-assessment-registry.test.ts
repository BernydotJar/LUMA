import { describe, expect, it } from "vitest";
import { getClassContract } from "./class-contract";
import {
  assessmentCatalogPaths,
  validatePublishedProgramAssessment,
} from "./program-assessment-registry";
import { evaluateProgramEntryAssessment, getProgramEntryQuestions, entryAssessmentNextAction } from "./program-assessment";

const scope = { tenantId: "se-academy", programId: "pnl-practitioner" };
const classSlugs = ["calibracion-observar-antes-de-interpretar", "congruencia-tres-canales"];
const sourceIds = [...new Set(classSlugs.flatMap((slug) => getClassContract(slug)!.sourceIds))];

function records(overrides: {
  pointer?: Record<string, unknown>;
  revision?: Record<string, unknown>;
  offering?: Record<string, unknown>;
} = {}) {
  const pointer = {
    schemaVersion: 1, tenantId: scope.tenantId, programId: scope.programId,
    status: "published", activeVersion: "se-practitioner-entry-v1", offeringId: "offering-qa-1",
    ...overrides.pointer,
  };
  const revision = {
    schemaVersion: 1, tenantId: scope.tenantId, programId: scope.programId,
    status: "approved", version: "se-practitioner-entry-v1",
    curriculumRevision: "practitioner-revision-v1",
    offeringId: "offering-qa-1", classSlugs, sourceIds,
    recommendedNextSlug: classSlugs[1],
    submittedByUid: "curriculum-author", approvedByUid: "curriculum-reviewer",
    approvedAt: "2026-10-20T12:00:00.000Z", publishedAt: "2026-10-20T13:00:00.000Z",
    ...overrides.revision,
  };
  const offering = {
    offeringId: "offering-qa-1", tenantId: scope.tenantId, programId: scope.programId,
    status: "active", ...overrides.offering,
  };
  return [pointer, revision, offering] as const;
}

describe("P0 #85 program-specific published assessment", () => {
  it("derives hashed per-program paths instead of trusting client doc IDs", () => {
    const a = assessmentCatalogPaths(scope);
    const b = assessmentCatalogPaths({ ...scope, programId: "pnl-advanced" });
    const foreign = assessmentCatalogPaths({ tenantId: "another-academy", programId: scope.programId });
    expect(a.pointer).not.toEqual(b.pointer);
    expect(a.pointer).not.toEqual(foreign.pointer);
    expect(a.version("se-practitioner-entry-v1")).toContain("/versions/se-practitioner-entry-v1");
    expect(() => a.version("../admin")).toThrow("ASSESSMENT_VERSION_INVALID");
  });

  it("accepts only approved catalog tied to a matching active offering and source set", () => {
    const [pointer, revision, offering] = records();
    const result = validatePublishedProgramAssessment(scope, pointer, revision, offering);
    expect(result).not.toBeNull();
    expect(result?.version).toBe("se-practitioner-entry-v1");
    expect(result?.classSlugs).toEqual(classSlugs);
  });

  it.each([
    { name: "other tenant", pointer: { tenantId: "other" } },
    { name: "other program", revision: { programId: "other" } },
    { name: "draft pointer", pointer: { status: "draft" } },
    { name: "unreviewed snapshot", revision: { status: "draft" } },
    { name: "unpublished offering", offering: { status: "draft" } },
    { name: "foreign offering", offering: { tenantId: "other" } },
    { name: "unreviewed version", revision: { version: "se-practitioner-entry-v2" } },
    { name: "self approval", revision: { approvedByUid: "curriculum-author" } },
    { name: "missing approval", revision: { approvedByUid: "" } },
    { name: "source swap", revision: { sourceIds: ["foreign"] } },
    { name: "source injection", revision: { sourceIds: [...sourceIds, "foreign"] } },
    { name: "unknown class", revision: { classSlugs: ["../admin"] } },
    { name: "off-curriculum next step", revision: { recommendedNextSlug: "pas-detectar-y-reformular" } },
    { name: "future publication", revision: { publishedAt: "2099-01-01T00:00:00.000Z" } },
    { name: "missing version", pointer: { activeVersion: "" } },
  ])("rejects $name rather than falling back to generic SE questions", ({ pointer, revision, offering }) => {
    const values = records({ pointer, revision, offering });
    expect(validatePublishedProgramAssessment(scope, ...values)).toBeNull();
  });

  it("uses only approved slugs in public questions and persisted nonmastering route", () => {
    const approved = validatePublishedProgramAssessment(scope, ...records())!;
    const questions = getProgramEntryQuestions(approved);
    expect(questions).toHaveLength(2);
    expect(questions.map((q) => q.slug)).toEqual(classSlugs);
    expect(JSON.stringify(questions)).not.toContain('"correct"');
    const answers = Object.fromEntries(questions.map((q) => [
      q.slug, getClassContract(q.slug)!.diagnostic.choices.find((c) => c.correct)!.id,
    ]));
    const summary = evaluateProgramEntryAssessment(answers, "2026-10-20T14:00:00.000Z", approved);
    expect(summary?.correct).toBe(2);
    expect(summary?.recommendedSlug).toBe(classSlugs[1]);
    expect(summary?.programId).toBe(scope.programId);
    expect(summary?.curriculumRevision).toBe("practitioner-revision-v1");
    expect(summary?.twinAuthority).toBe("none");
    expect(entryAssessmentNextAction(summary!)?.href).toBe("/learn/experience/" + classSlugs[1]);
    expect(evaluateProgramEntryAssessment({
      ...answers, "pas-detectar-y-reformular": "a",
    }, "2026-10-20T14:00:00.000Z", approved)).toBeUndefined();
  });
});
