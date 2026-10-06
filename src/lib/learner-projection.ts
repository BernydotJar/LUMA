import { selectNextLearningAction } from "./learning-engine";
import { evidenceMayUpdateTwin, type SimulationCriterionResult } from "./simulation-evidence";
import {
  journeySteps,
  learnerState as showcaseLearnerState,
  learningActions,
  nextAction as showcaseNextAction,
  twinDimensions,
} from "./luma-data";
import type {
  JourneyStep,
  LearnerConceptState,
  LearnerState,
  MasteryBand,
  RankedLearningAction,
  TwinDimension,
} from "../types/learning";

export type OnboardingGoal = "emotions" | "beliefs" | "communication";

export interface StoredOnboardingState {
  goal: string;
  diagnostic: string | null;
  confidence: number;
  minutes: number;
  createdAt?: string;
}

export interface StoredLearningEvent {
  eventId?: string;
  type: string;
  conceptId?: string;
  correctCount?: number;
  answers?: Record<string, string>;
  attempts?: Record<string, number>;
  completedAt?: string;
  sourceId?: string;
  evidenceCategory?: "scored" | "observed" | "self-reported";
  twinAuthority?: "none" | "supporting" | "eligible";
  rubricId?: string;
  criteria?: SimulationCriterionResult[];
}

export interface AdaptiveLearningPlan {
  state: LearnerState;
  nextAction: RankedLearningAction;
  previousAction?: RankedLearningAction;
  routeChanged: boolean;
  journey: JourneyStep[];
  dimensions: TwinDimension[];
}

const goalConfig: Record<OnboardingGoal, { label: string; focusConceptIds: string[] }> = {
  emotions: {
    label: "Gestionar mejor mis emociones",
    focusConceptIds: ["pas"],
  },
  beliefs: {
    label: "Transformar creencias que me frenan",
    focusConceptIds: ["beliefs"],
  },
  communication: {
    label: "Comunicarme con más claridad",
    focusConceptIds: ["emotional-communication"],
  },
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

function normalizeGoal(goal: string): OnboardingGoal {
  if (goal === "emotions" || goal === "communication") return goal;
  return "beliefs";
}

function updateConcept(
  concept: LearnerConceptState,
  updates: Partial<LearnerConceptState>,
): LearnerConceptState {
  return { ...concept, ...updates };
}

export function parseStoredOnboarding(raw: string | null): StoredOnboardingState | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as StoredOnboardingState;
    if (!parsed || typeof parsed.goal !== "string" || typeof parsed.minutes !== "number") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function parseStoredLearningEvent(raw: string | null): StoredLearningEvent | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as StoredLearningEvent;
    if (!parsed || typeof parsed.type !== "string") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function projectLearnerState(
  onboarding?: StoredOnboardingState,
  event?: StoredLearningEvent,
): LearnerState {
  if (!onboarding) {
    return event
      ? applyLearningEvent({ ...showcaseLearnerState, concepts: showcaseLearnerState.concepts.map((item) => ({ ...item })) }, event)
      : showcaseLearnerState;
  }

  const goalId = normalizeGoal(onboarding.goal);
  const correctDiagnostic = onboarding.diagnostic === "b";
  const selfConfidence = clamp((onboarding.confidence || 1) / 5, 0.2, 1);

  const concepts = showcaseLearnerState.concepts.map((concept) => {
    if (concept.conceptId === "emotional-communication") {
      return updateConcept(concept, {
        mastery: goalId === "communication" ? 0.52 : 0.68,
        confidence: goalId === "communication" ? selfConfidence : Math.max(0.56, selfConfidence),
        attempts: 0,
        consecutiveFailures: 0,
        completedContent: false,
      });
    }

    if (concept.conceptId === "pas") {
      return updateConcept(concept, {
        mastery: correctDiagnostic ? 0.64 : 0.34,
        confidence: Math.min(0.76, selfConfidence),
        attempts: onboarding.diagnostic ? 1 : 0,
        consecutiveFailures: onboarding.diagnostic && !correctDiagnostic ? 1 : 0,
        completedContent: false,
      });
    }

    if (concept.conceptId === "logical-levels") {
      return updateConcept(concept, {
        mastery: goalId === "beliefs" && correctDiagnostic ? 0.6 : 0.48,
        confidence: Math.min(0.66, selfConfidence),
        attempts: 0,
        consecutiveFailures: 0,
        completedContent: false,
      });
    }

    return updateConcept(concept, {
      mastery: goalId === "beliefs" ? 0.42 : 0.32,
      confidence: Math.min(0.62, selfConfidence),
      attempts: 0,
      consecutiveFailures: 0,
      completedContent: false,
    });
  });

  const projected: LearnerState = {
    learnerId: "onboarding-learner",
    goal: goalConfig[goalId].label,
    availableMinutes: onboarding.minutes,
    focusConceptIds: goalConfig[goalId].focusConceptIds,
    concepts,
  };

  return event ? applyLearningEvent(projected, event) : projected;
}

export function applyLearningEvent(
  state: LearnerState,
  event: StoredLearningEvent,
): LearnerState {
  if (event.type !== "SIMULATION_COMPLETED" || !event.conceptId) return state;
  if (!evidenceMayUpdateTwin(event)) return state;

  const success = event.criteria?.length
    ? event.criteria.every((criterion) => criterion.passed)
    : (event.correctCount ?? 0) >= 3;
  return {
    ...state,
    concepts: state.concepts.map((concept) => {
      if (concept.conceptId !== event.conceptId) return concept;
      return {
        ...concept,
        mastery: success ? Math.max(concept.mastery, 0.88) : Math.max(concept.mastery, 0.46),
        confidence: success ? Math.max(concept.confidence, 0.8) : Math.max(concept.confidence, 0.48),
        attempts: concept.attempts + 1,
        consecutiveFailures: success ? 0 : concept.consecutiveFailures + 1,
        completedContent: success || concept.completedContent,
      };
    }),
  };
}

function currentConceptForAction(action: RankedLearningAction): string {
  return action.id === "pas-to-beliefs" ? "beliefs" : action.conceptId;
}

function projectJourney(state: LearnerState, action: RankedLearningAction): JourneyStep[] {
  const currentConceptId = currentConceptForAction(action);
  const concepts = new Map(state.concepts.map((concept) => [concept.conceptId, concept]));

  return journeySteps.map((step) => {
    if (step.id === "goal") {
      return { ...step, detail: state.goal, status: "complete" };
    }

    if (step.conceptId === currentConceptId) {
      return {
        ...step,
        detail: `LUMA priorizó este tramo: ${action.title}.`,
        status: "current",
      };
    }

    const concept = concepts.get(step.conceptId);
    if (concept && concept.mastery >= 0.82) {
      return { ...step, detail: "Dominio demostrado con evidencia reciente.", status: "complete" };
    }

    return { ...step, status: "upcoming" };
  });
}

function bandForScore(score: number): MasteryBand {
  if (score >= 78) return "strong";
  if (score >= 58) return "developing";
  return "needs-attention";
}

function projectDimensions(
  state: LearnerState,
  onboarding?: StoredOnboardingState,
): TwinDimension[] {
  const concepts = new Map(state.concepts.map((concept) => [concept.conceptId, concept]));
  const averageMastery =
    state.concepts.reduce((sum, concept) => sum + concept.mastery, 0) / state.concepts.length;
  const application = Math.round((concepts.get("pas")?.mastery ?? 0.5) * 100);
  const confidence = onboarding
    ? Math.round(clamp(onboarding.confidence / 5) * 100)
    : Math.round(
        (state.concepts.reduce((sum, concept) => sum + concept.confidence, 0) / state.concepts.length) * 100,
      );

  return twinDimensions.map((dimension) => {
    let score = dimension.score;
    if (dimension.id === "knowledge") score = Math.round(averageMastery * 100);
    if (dimension.id === "application") score = application;
    if (dimension.id === "confidence") score = confidence;

    return {
      ...dimension,
      score,
      band: bandForScore(score),
    };
  });
}

export function createAdaptiveLearningPlanFromState(
  state: LearnerState,
  onboarding?: StoredOnboardingState,
  previousAction?: RankedLearningAction,
): AdaptiveLearningPlan {
  const nextAction = selectNextLearningAction(state, learningActions) ?? showcaseNextAction;
  const routeChanged = Boolean(previousAction && previousAction.id !== nextAction.id);

  return {
    state,
    nextAction,
    previousAction: routeChanged ? previousAction : undefined,
    routeChanged,
    journey: projectJourney(state, nextAction),
    dimensions: projectDimensions(state, onboarding),
  };
}

export function createAdaptiveLearningPlan(
  onboarding?: StoredOnboardingState,
  event?: StoredLearningEvent,
): AdaptiveLearningPlan {
  const beforeEvidenceState = projectLearnerState(onboarding);
  const previousAction =
    selectNextLearningAction(beforeEvidenceState, learningActions) ?? showcaseNextAction;
  const state = projectLearnerState(onboarding, event);
  return createAdaptiveLearningPlanFromState(
    state,
    onboarding,
    event ? previousAction : undefined,
  );
}
