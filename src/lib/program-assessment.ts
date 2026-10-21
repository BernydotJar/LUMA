import { getClassContract } from "./class-contract";
import { getLearningExperience } from "./learning-content";
import type { RankedLearningAction } from "../types/learning";

/**
 * A low-stakes program entry assessment. Answers guide the route; they never
 * raise mastery, issue credentials, or substitute for scored practice.
 */
export const PROGRAM_ENTRY_ASSESSMENT_VERSION = "se-practitioner-entry-v1";
const entrySlugs = [
  "calibracion-observar-antes-de-interpretar",
  "congruencia-tres-canales",
  "rapport-sintonia-con-respeto",
  "pas-detectar-y-reformular",
  "creencias-evidencia-e-interpretacion",
] as const;

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
}

export function getProgramEntryQuestions() {
  return entrySlugs.map((slug) => {
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
): ProgramEntryAssessmentSummary | undefined {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return undefined;
  const submitted = answers as Record<string, unknown>;
  if (
    Object.keys(submitted).length !== entrySlugs.length ||
    !entrySlugs.every((slug) => Object.hasOwn(submitted, slug))
  ) return undefined;

  const results = entrySlugs.map((slug) => {
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
  const recommendedSlug = needsPractice[0] ?? "niveles-logicos-donde-intervenir";

  return {
    version: PROGRAM_ENTRY_ASSESSMENT_VERSION,
    completedAt,
    total: entrySlugs.length,
    correct: valid.filter((item) => item.correct).length,
    recommendedSlug,
    needsPractice,
    results: valid,
    evidenceCategory: "observed",
    twinAuthority: "none",
  };
}

export function entryAssessmentNextAction(
  summary: ProgramEntryAssessmentSummary,
): RankedLearningAction | undefined {
  if (summary.version !== PROGRAM_ENTRY_ASSESSMENT_VERSION) return undefined;
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
