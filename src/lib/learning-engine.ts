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
      reason: "Esta acción pertenece a otro contexto de aprendizaje.",
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
  const focusConceptIds = state.focusConceptIds ?? [];
  const directGoalFocus = focusConceptIds.includes(action.conceptId);
  const supportsGoalFocus = focusConceptIds.some((focusConceptId) =>
    concepts.get(focusConceptId)?.prerequisiteIds.includes(action.conceptId),
  );
  const goalFocusWeight = directGoalFocus ? 1.35 : supportsGoalFocus ? 0.65 : 0;

  let kindWeight = 0.5;
  if (concept.consecutiveFailures >= 2) {
    kindWeight = ["review", "practice", "simulation"].includes(action.kind) ? 1 : 0.1;
  } else if (concept.mastery >= 0.82) {
    kindWeight = action.kind === "continue" ? 1 : 0.22;
  } else if (concept.attempts === 0) {
    kindWeight = action.kind === "diagnostic"
      ? 1
      : ["practice", "simulation"].includes(action.kind)
        ? 0.82
        : 0.25;
  } else if (["practice", "simulation"].includes(action.kind)) {
    kindWeight = 0.92;
  }

  const prerequisitePenalty = unmetPrerequisites.length * 1.15;
  const score =
    masteryGap * 3.1 +
    confidenceGap * 1.25 +
    failureSignal * 2.35 +
    completionMismatch * 1.9 +
    timeFit * 1.1 +
    kindWeight * 1.2 +
    goalFocusWeight -
    prerequisitePenalty;

  let reason = `Cierra una brecha de dominio de ${Math.round(masteryGap * 100)} puntos.`;
  if (unmetPrerequisites.length > 0) {
    reason = `Antes de esta acción faltan ${unmetPrerequisites.length} prerrequisito(s); LUMA prioriza la mejor alternativa disponible para cerrarlos.`;
  } else if (concept.consecutiveFailures >= 2) {
    reason = "Dos intentos recientes muestran que una práctica guiada de transferencia es el mejor siguiente paso.";
  } else if (completionMismatch) {
    reason = "El contenido está completado y la siguiente señal útil es una práctica de transferencia.";
  } else if (concept.mastery >= 0.82) {
    reason = "La evidencia permite avanzar al siguiente reto.";
  } else if (concept.confidence < 0.5) {
    reason = "El conocimiento está emergiendo y una práctica breve puede consolidar confianza y aplicación.";
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
