import {
  applyLearningEvent,
  createAdaptiveLearningPlanFromState,
  projectLearnerState,
  type AdaptiveLearningPlan,
  type StoredLearningEvent,
  type StoredOnboardingState,
} from "./learner-projection";
import type { LearnerState } from "../types/learning";

export interface PersistedLearnerRecord {
  schemaVersion: 1;
  learnerId: string;
  journeyId: string;
  onboarding: StoredOnboardingState;
  state: LearnerState;
  nextActionId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastEventId?: string;
}



const pasAnswerKey = {
  thought: "pas",
  emotion: "shame",
  reframe: "balanced",
} as const;

export function verifyLearningEvent(value: unknown): StoredLearningEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const event = value as Record<string, unknown>;
  if (event.type !== "SIMULATION_COMPLETED" || event.conceptId !== "pas") return undefined;
  if (!event.answers || typeof event.answers !== "object") return undefined;

  const answers = event.answers as Record<string, unknown>;
  const normalizedAnswers = Object.fromEntries(
    Object.entries(pasAnswerKey).map(([key]) => [key, String(answers[key] ?? "")]),
  );
  const correctCount = Object.entries(pasAnswerKey).filter(
    ([key, expected]) => normalizedAnswers[key] === expected,
  ).length;

  return {
    type: "SIMULATION_COMPLETED",
    conceptId: "pas",
    answers: normalizedAnswers,
    correctCount,
    attempts:
      event.attempts && typeof event.attempts === "object"
        ? (event.attempts as Record<string, number>)
        : undefined,
    completedAt: typeof event.completedAt === "string" ? event.completedAt : undefined,
    sourceId: typeof event.sourceId === "string" ? event.sourceId : undefined,
  };
}

export interface AppliedLearningEvent {
  record: PersistedLearnerRecord;
  plan: AdaptiveLearningPlan;
}

export function createPersistentLearnerRecord(
  learnerId: string,
  onboarding: StoredOnboardingState,
  now = new Date().toISOString(),
): AppliedLearningEvent {
  const normalizedOnboarding = {
    ...onboarding,
    createdAt: onboarding.createdAt || now,
  };
  const projectedState = projectLearnerState(normalizedOnboarding);
  const state = { ...projectedState, learnerId };
  const plan = createAdaptiveLearningPlanFromState(state, normalizedOnboarding);

  return {
    record: {
      schemaVersion: 1,
      learnerId,
      journeyId: normalizedOnboarding.createdAt || now,
      onboarding: normalizedOnboarding,
      state,
      nextActionId: plan.nextAction.id,
      version: 1,
      createdAt: now,
      updatedAt: now,
    },
    plan,
  };
}

export function applyEventToPersistentLearner(
  current: PersistedLearnerRecord,
  eventId: string,
  event: StoredLearningEvent,
  now = new Date().toISOString(),
): AppliedLearningEvent {
  const previousPlan = createAdaptiveLearningPlanFromState(
    current.state,
    current.onboarding,
  );
  const nextState = applyLearningEvent(current.state, { ...event, eventId });
  const plan = createAdaptiveLearningPlanFromState(
    nextState,
    current.onboarding,
    previousPlan.nextAction,
  );

  return {
    record: {
      ...current,
      state: nextState,
      nextActionId: plan.nextAction.id,
      version: current.version + 1,
      updatedAt: now,
      lastEventId: eventId,
    },
    plan,
  };
}
