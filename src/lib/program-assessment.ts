import { getClassContract } from "./class-contract";
import { SE_PRACTITIONER_CLASS_SLUGS, type PublishedProgramAssessment } from "./program-assessment-registry";
import { getLearningExperience } from "./learning-content";
import type { RankedLearningAction } from "../types/learning";

/**
 * A low-stakes program entry assessment. Answers guide the route; they never
 * raise mastery, issue credentials, or substitute for scored practice.
 */
export const PROGRAM_ENTRY_ASSESSMENT_VERSION = "se-practitioner-entry-v1";
const entrySlugs = SE_PRACTITIONER_CLASS_SLUGS;

export interface ProgramEntryAssessmentSummary {
  version: string;
  completedAt: string;
  total: number;
  correct: number;
  recommendedSlug: string;
  needsPractice: string[];
  results: Array<{ slug: string; correct: boolean; feedback: string }>;
  evidenceCategory: "observed";
  twinAuthority: "none";
  tenantId?: string;
  programId?: string;
  offeringId?: string;
  curriculumRevision?: string;
}

export function getProgramEntryQuestions(approved?: PublishedProgramAssessment) {
  return (approved?.classSlugs ?? entrySlugs).map((slug) => {
    const contract = getClassContract(slug);
    const experience = getLearningExperience(slug);
    if (!contract || !experience) throw new Error("PROGRAM_ASSESSMENT_CONTRACT_MISSING");
    return {
      slug,
      title: experience.shortTitle,
      capability: experience.capability,
      prompt: contract.diagnostic.prompt,
      choices: contract.diagnostic.choices.map(({ id, label }) => ({ id, label })),
    };
  });
}

/** Reject partial, unknown and malformed answers; never accept client scoring. */
export function evaluateProgramEntryAssessment(
  answers: unknown,
  completedAt = new Date().toISOString(),
  approved?: PublishedProgramAssessment,
): ProgramEntryAssessmentSummary | undefined {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return undefined;
  const submitted = answers as Record<string, unknown>;
  const activeSlugs = approved?.classSlugs ?? entrySlugs;
  if (
    Object.keys(submitted).length !== activeSlugs.length ||
    !activeSlugs.every((slug) => Object.hasOwn(submitted, slug))
  ) return undefined;

  const results = activeSlugs.map((slug) => {
    const selected = submitted[slug];
    const contract = getClassContract(slug);
    if (typeof selected !== "string" || !contract) return undefined;
    const choice = contract.diagnostic.choices.find((item) => item.id === selected);
    if (!choice) return undefined;
    return { slug, correct: choice.correct, feedback: choice.feedback };
  });
  if (results.some((item) => !item)) return undefined;

  const valid = results as NonNullable<(typeof results)[number]>[];
  const needsPractice = valid.filter((item) => !item.correct).map((item) => item.slug);
  const recommendedSlug = needsPractice[0] ??
    approved?.recommendedNextSlug ?? "niveles-logicos-donde-intervenir";

  return {
    version: approved?.version ?? PROGRAM_ENTRY_ASSESSMENT_VERSION,
    completedAt,
    total: activeSlugs.length,
    correct: valid.filter((item) => item.correct).length,
    recommendedSlug,
    needsPractice,
    results: valid,
    evidenceCategory: "observed",
    twinAuthority: "none",
    ...(approved ? {
      tenantId: approved.tenantId,
      programId: approved.programId,
      offeringId: approved.offeringId,
      curriculumRevision: approved.curriculumRevision,
    } : {}),
  };
}

export function entryAssessmentNextAction(
  summary: ProgramEntryAssessmentSummary,
): RankedLearningAction | undefined {
  if (!/^[a-z][a-z0-9-]{2,95}$/.test(summary.version) ||
    summary.twinAuthority !== "none") return undefined;
  const experience = getLearningExperience(summary.recommendedSlug);
  if (!experience) return undefined;
  const needsPractice = summary.needsPractice.includes(summary.recommendedSlug);
  return {
    id: "program-entry-" + experience.id,
    kind: needsPractice ? "review" : "practice",
    conceptId: experience.id,
    title: needsPractice ? "Empieza por " + experience.shortTitle : "Siguiente desafío: " + experience.shortTitle,
    description: needsPractice
      ? "Tu respuesta de entrada sugiere revisar esta distinción y llevarla a una práctica concreta."
      : "En las preguntas de entrada no aparecieron brechas; continuemos con una práctica nueva.",
    minutes: experience.minutes,
    sourceLabel: experience.sourceLabel,
    sourceUrl: "",
    targetMastery: 0,
    prerequisiteIds: [],
    href: "/learn/experience/" + experience.slug,
    score: 0,
    confidence: 0,
    reason:
      "Orientación derivada de un diagnóstico breve, no de evidencia de dominio. " +
      "Una práctica evaluada puede cambiar tu siguiente paso.",
  };
}
