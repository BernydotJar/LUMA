import type {
  LearnerConceptState,
  LearnerState,
  LearningAction,
  RankedLearningAction,
} from "@/types/learning";

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

function conceptMap(state: LearnerState): Map<string, LearnerConceptState> {
  return new Map(state.concepts.map((concept) => [concept.conceptId, concept]));
}

export function scoreLearningAction(
  state: LearnerState,
  action: LearningAction,
): RankedLearningAction {
  const concepts = conceptMap(state);
  const concept = concepts.get(action.conceptId);

  if (!concept) {
    return {
      ...action,
      score: -100,
      reason: "La acción no corresponde a un concepto del Twin actual.",
      confidence: 0,
    };
  }

  const unmetPrerequisites = action.prerequisiteIds.filter(
    (id) => (concepts.get(id)?.mastery ?? 0) < 0.58,
  );
  const masteryGap = clamp(action.targetMastery - concept.mastery);
  const confidenceGap = clamp(0.72 - concept.confidence);
  const failureSignal = clamp(concept.consecutiveFailures / 3);
  const timeFit = action.minutes <= state.availableMinutes ? 1 : 0.18;
  const completionMismatch = concept.completedContent && concept.mastery < 0.65 ? 1 : 0;

  let kindWeight = 0.5;
  if (concept.consecutiveFailures >= 2) {
    kindWeight = ["review", "practice", "simulation"].includes(action.kind) ? 1 : 0.1;
  } else if (concept.mastery >= 0.82) {
    kindWeight = action.kind === "continue" ? 1 : 0.22;
  } else if (concept.attempts === 0) {
    kindWeight = action.kind === "diagnostic" ? 1 : 0.55;
  } else if (["practice", "simulation"].includes(action.kind)) {
    kindWeight = 0.92;
  }

  const prerequisitePenalty = unmetPrerequisites.length * 0.45;
  const score =
    masteryGap * 3.1 +
    confidenceGap * 1.25 +
    failureSignal * 2.35 +
    completionMismatch * 1.9 +
    timeFit * 1.1 +
    kindWeight * 1.2 -
    prerequisitePenalty;

  let reason = `Cierra una brecha de dominio de ${Math.round(masteryGap * 100)} puntos.`;
  if (unmetPrerequisites.length > 0) {
    reason = `Primero conviene reforzar ${unmetPrerequisites.length} prerrequisito(s).`;
  } else if (concept.consecutiveFailures >= 2) {
    reason = "Dos intentos fallidos seguidos indican que avanzar ahora aumentaría la confusión.";
  } else if (completionMismatch) {
    reason = "Terminaste el contenido, pero la evidencia todavía no demuestra dominio.";
  } else if (concept.mastery >= 0.82) {
    reason = "La evidencia es suficiente para evitar repetición y avanzar.";
  } else if (concept.confidence < 0.5) {
    reason = "El conocimiento emergente y la baja confianza hacen útil una práctica breve.";
  }

  return {
    ...action,
    score: Number(score.toFixed(4)),
    reason,
    confidence: Number(
      clamp(0.48 + masteryGap * 0.23 + timeFit * 0.14 - prerequisitePenalty * 0.15).toFixed(2),
    ),
  };
}

export function rankLearningActions(
  state: LearnerState,
  actions: LearningAction[],
): RankedLearningAction[] {
  return actions
    .map((action) => scoreLearningAction(state, action))
    .sort((a, b) => b.score - a.score || a.minutes - b.minutes);
}

export function selectNextLearningAction(
  state: LearnerState,
  actions: LearningAction[],
): RankedLearningAction | undefined {
  return rankLearningActions(state, actions)[0];
}
