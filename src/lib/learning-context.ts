import { getClassContract } from "./class-contract";
import { getLearningExperience } from "./learning-content";
import type { AdaptiveLearningPlan } from "./learner-projection";

export type LearningStep = "overview" | "diagnostic" | "concept" | "practice" | "simulation" | "remediation" | "transfer" | "reflection" | "recheck";

export type LearningContextHint = {
  classSlug: string;
  step: LearningStep;
};

const validSteps: readonly LearningStep[] = [
  "overview", "diagnostic", "concept", "practice", "simulation",
  "remediation", "transfer", "reflection", "recheck",
];

/** Caller input is a routing hint, never authoritative knowledge or evidence. */
export function parseLearningContextHint(input: unknown): LearningContextHint | undefined {
  if (input === undefined || input === null) return undefined;
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some((key) => !["classSlug", "step"].includes(key))) return undefined;
  if (typeof value.classSlug !== "string" || value.classSlug.length > 120) return undefined;
  if (!getClassContract(value.classSlug)) return undefined;
  if (value.step !== undefined && !validSteps.includes(value.step as LearningStep)) return undefined;
  return { classSlug: value.classSlug, step: (value.step ?? "overview") as LearningStep };
}

export type LearningContextEnvelope = {
  classSlug: string;
  classTitle: string;
  objective: string;
  capability: string;
  capabilityId: string;
  step: LearningStep;
  allowedSourceIds: string[];
  nextAction: { title: string; href: string };
  masteryBasis: "scored-evidence" | "diagnostic-only" | "not-measured";
  recentEvidence: Array<{ type: string; authority: string }>;
};

/** Construct solely from server-owned contracts and the entitled learner plan. */
export function createLearningContextEnvelope(
  hint: LearningContextHint,
  plan: AdaptiveLearningPlan,
  recentEvents: Array<{ type?: unknown; twinAuthority?: unknown; sourceId?: unknown; classId?: unknown; conceptId?: unknown }> = [],
): LearningContextEnvelope {
  const contract = getClassContract(hint.classSlug);
  const experience = getLearningExperience(hint.classSlug);
  if (!contract || !experience) throw new Error("LEARNING_CONTEXT_CLASS_NOT_FOUND");

  const recentEvidence = recentEvents
    .filter((event) => typeof event.type === "string")
    .filter((event) => (
      typeof event.sourceId === "string" &&
      contract.sourceIds.includes(event.sourceId) &&
      (event.classId === hint.classSlug || event.conceptId === contract.capabilityId)
    ))
    .slice(0, 5)
    .map((event) => ({
      type: String(event.type).slice(0, 64),
      authority: ["eligible", "supporting", "none"].includes(String(event.twinAuthority))
        ? String(event.twinAuthority) : "none",
    }));

  const hasScoredEvidence = recentEvidence.some((event) => event.authority === "eligible");
  const hasDiagnostic = plan.entryAssessment?.results.some(
    (item) => item.slug === hint.classSlug,
  ) ?? false;

  return {
    classSlug: hint.classSlug,
    classTitle: experience.shortTitle,
    objective: contract.objective,
    capability: experience.capability,
    capabilityId: contract.capabilityId,
    step: hint.step,
    allowedSourceIds: [...contract.sourceIds],
    nextAction: {
      title: plan.nextAction.title,
      href: plan.nextAction.href ?? "/learn/experiences",
    },
    masteryBasis: hasScoredEvidence ? "scored-evidence"
      : hasDiagnostic ? "diagnostic-only" : "not-measured",
    recentEvidence,
  };
}

/** RAG must be authorized by program first, then by the current class source boundary. */
export function isLearningContextSourceAllowed(
  context: LearningContextEnvelope,
  hit: { sourceId: string; driveFileId?: string },
): boolean {
  return context.allowedSourceIds.includes(hit.sourceId) ||
    (typeof hit.driveFileId === "string" && context.allowedSourceIds.includes(hit.driveFileId));
}

/** Return only information needed for a contextual learner-facing explanation. */
export function publicLearningContext(envelope: LearningContextEnvelope) {
  return {
    classTitle: envelope.classTitle,
    objective: envelope.objective,
    capability: envelope.capability,
    step: envelope.step,
    masteryBasis: envelope.masteryBasis,
    nextAction: envelope.nextAction,
  };
}
