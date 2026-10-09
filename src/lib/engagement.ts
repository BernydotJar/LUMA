import type { PersistedLearnerRecord } from "./persistent-learning";

export type InterventionPriority = "low" | "medium" | "high";

export interface LearnerEngagementSignal {
  learnerId: string;
  priority: InterventionPriority;
  score: number;
  inactivityDays: number;
  averageMastery: number;
  completionRate: number;
  maxConsecutiveFailures: number;
  reasons: string[];
  recommendation: string;
  updatedAt: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

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
  const maxConsecutiveFailures = concepts.reduce(
    (max, concept) => Math.max(max, concept.consecutiveFailures),
    0,
  );
  const inactivityDays = Math.max(
    0,
    Math.floor((nowMs - updatedMs) / 86_400_000),
  );

  let score = 0;
  const reasons: string[] = [];

  if (inactivityDays >= 14) {
    score += 45;
    reasons.push(`Sin actividad durante ${inactivityDays} días`);
  } else if (inactivityDays >= 7) {
    score += 28;
    reasons.push(`Sin actividad durante ${inactivityDays} días`);
  } else if (inactivityDays >= 3) {
    score += 10;
  }

  if (averageMastery < 0.45) {
    score += 28;
    reasons.push("Dominio medio por debajo de 45%");
  } else if (averageMastery < 0.65) {
    score += 14;
    reasons.push("Dominio medio todavía en desarrollo");
  }

  if (maxConsecutiveFailures >= 3) {
    score += 22;
    reasons.push(`${maxConsecutiveFailures} intentos fallidos consecutivos en una capacidad`);
  } else if (maxConsecutiveFailures >= 2) {
    score += 12;
    reasons.push("Repetición de intentos fallidos");
  }

  if (completionRate < 0.25 && record.version > 1) {
    score += 10;
    reasons.push("Poca evidencia de capacidades completadas");
  }

  score = clamp(score);
  const priority: InterventionPriority =
    score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const recommendation =
    priority === "high"
      ? "Check-in humano breve antes de asignar más contenido."
      : priority === "medium"
        ? "Recordatorio contextual y una siguiente acción pequeña."
        : "Mantener seguimiento; no intervenir salvo nueva señal.";

  return {
    learnerId: record.learnerId,
    priority,
    score,
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
