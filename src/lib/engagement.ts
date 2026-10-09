import type { PersistedLearnerRecord } from "./persistent-learning";

export type InterventionPriority = "low" | "medium" | "high";
export type LearnerRiskState =
  | "insufficient_evidence"
  | "healthy"
  | "watch"
  | "at_risk"
  | "human_intervention";

export interface LearnerEngagementSignal {
  learnerId: string;
  priority: InterventionPriority;
  riskState: LearnerRiskState;
  evidenceBasis: "activity_only" | "verified_practice";
  score: number;
  inactivityDays: number;
  /** Learning model projection, NOT an independently tested ability metric. */
  averageMastery: number;
  completionRate: number;
  maxConsecutiveFailures: number;
  reasons: string[];
  recommendation: string;
  updatedAt: string;
}

/**
 * Rule-based triage. A baseline projection is not evidence of failure/mastery.
 * Only post-onboarding verified practice events may count as concept friction.
 * Activity is measured from the timestamp of the persisted learner record.
 */
export function evaluateLearnerEngagement(
  record: PersistedLearnerRecord,
  now = new Date().toISOString(),
): LearnerEngagementSignal {
  const nowMs = Date.parse(now);
  const updatedMs = Date.parse(record.updatedAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(updatedMs)) {
    throw new Error("engagement timestamps must be valid ISO values");
  }

  const concepts = record.state.concepts;
  const averageMastery =
    concepts.length > 0
      ? concepts.reduce((sum, concept) => sum + concept.mastery, 0) /
        concepts.length
      : 0;
  const completionRate =
    concepts.length > 0
      ? concepts.filter((concept) => concept.completedContent).length /
        concepts.length
      : 0;
  // Baseline onboarding values can be projections. A last persisted practice
  // event is required before any simulated mastery/friction signal is used.
  const verifiedPractice = record.version > 1 &&
    typeof record.lastEventId === "string" && record.lastEventId.trim().length > 0;
  const maxConsecutiveFailures = verifiedPractice
    ? concepts.reduce((max, concept) => Math.max(max, concept.consecutiveFailures), 0)
    : 0;
  const inactivityDays = Math.max(
    0,
    Math.floor((nowMs - updatedMs) / 86_400_000),
  );

  const reasons: string[] = [];
  let score = 0;
  if (inactivityDays >= 14) {
    score += 45;
    reasons.push(`Sin actividad registrada durante ${inactivityDays} días`);
  } else if (inactivityDays >= 7) {
    score += 28;
    reasons.push(`Sin actividad registrada durante ${inactivityDays} días`);
  } else if (inactivityDays >= 3) {
    score += 10;
  }

  if (verifiedPractice && maxConsecutiveFailures >= 3) {
    score += 22;
    reasons.push(`${maxConsecutiveFailures} intentos fallidos consecutivos en una práctica evaluada`);
  } else if (verifiedPractice && maxConsecutiveFailures >= 2) {
    score += 12;
    reasons.push("Dos o más intentos fallidos en una práctica evaluada");
  }

  if (verifiedPractice && completionRate < 0.25) {
    score += 10;
    reasons.push("Poca evidencia de prácticas completadas");
  }

  const riskState: LearnerRiskState =
    inactivityDays >= 14 && verifiedPractice && maxConsecutiveFailures >= 3
      ? "human_intervention"
      : inactivityDays >= 14 || (verifiedPractice && maxConsecutiveFailures >= 3)
        ? "at_risk"
        : inactivityDays >= 7 || (verifiedPractice && maxConsecutiveFailures >= 2)
          ? "watch"
          : verifiedPractice
            ? "healthy"
            : "insufficient_evidence";

  if (riskState === "insufficient_evidence") {
    reasons.push("Aún no hay práctica evaluada suficiente para clasificar progreso");
  }

  const priority: InterventionPriority =
    riskState === "human_intervention" || riskState === "at_risk"
      ? "high"
      : riskState === "watch" ? "medium" : "low";

  const recommendation =
    riskState === "human_intervention"
      ? "Check-in humano breve antes de asignar más contenido."
      : riskState === "at_risk"
        ? "Contactar al aprendiz y contrastar las señales con su contexto."
        : riskState === "watch"
          ? "Recordatorio contextual y una siguiente acción pequeña."
          : riskState === "insufficient_evidence"
            ? "Invitar a la primera práctica, sin inferir capacidad ni riesgo."
            : "Mantener seguimiento; no intervenir salvo nueva señal.";

  return {
    learnerId: record.learnerId,
    priority,
    riskState,
    evidenceBasis: verifiedPractice ? "verified_practice" : "activity_only",
    score: Math.min(100, score),
    inactivityDays,
    averageMastery,
    completionRate,
    maxConsecutiveFailures,
    reasons,
    recommendation,
    updatedAt: record.updatedAt,
  };
}

export function rankLearnerInterventions(
  records: PersistedLearnerRecord[],
  now = new Date().toISOString(),
) {
  return records
    .map((record) => evaluateLearnerEngagement(record, now))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.learnerId.localeCompare(b.learnerId),
    );
}
