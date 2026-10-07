import {
  applyLearningEvent,
  createAdaptiveLearningPlanFromState,
  projectLearnerState,
  type AdaptiveLearningPlan,
  type StoredLearningEvent,
  type StoredOnboardingState,
} from "./learner-projection";
import type { LearnerState, RankedLearningAction } from "../types/learning";
import { evaluatePasSimulation } from "./simulation-evidence";

export interface PersistedLearnerRecord {
  schemaVersion: 1;
  learnerId: string;
  journeyId: string;
  onboarding: StoredOnboardingState;
  state: LearnerState;
  nextActionId: string;
  previousAction: RankedLearningAction | null;
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

function normalizeAttempts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object") return undefined;

  const raw = value as Record<string, unknown>;
  const attempts: Record<string, number> = {};
  for (const key of Object.keys(pasAnswerKey)) {
    const count = Number(raw[key]);
    if (Number.isInteger(count) && count >= 0 && count <= 25) {
      attempts[key] = count;
    }
  }

  return Object.keys(attempts).length > 0 ? attempts : undefined;
}

export function verifyLearningEvent(value: unknown): StoredLearningEvent | undefined {
  if (!value || typeof value !== "object") return undefined;
  const event = value as Record<string, unknown>;
  if (event.type !== "SIMULATION_COMPLETED" || event.conceptId !== "pas") return undefined;
  if (!event.answers || typeof event.answers !== "object") return undefined;

  const answers = event.answers as Record<string, unknown>;
  const normalizedAnswers = Object.fromEntries(
    Object.entries(pasAnswerKey).map(([key]) => [key, String(answers[key] ?? "")]),
  );
  const normalizedAttempts = normalizeAttempts(event.attempts);
  const evidence = evaluatePasSimulation(normalizedAnswers, normalizedAttempts ?? {});
  const correctCount = evidence.passedCriteria;

  const completedAt =
    typeof event.completedAt === "string" && event.completedAt.length <= 64
      ? event.completedAt
      : undefined;
  const sourceId =
    typeof event.sourceId === "string" && event.sourceId.length <= 256
      ? event.sourceId
      : undefined;

  return {
    type: "SIMULATION_COMPLETED",
    conceptId: "pas",
    answers: normalizedAnswers,
    correctCount,
    attempts: normalizedAttempts,
    completedAt,
    sourceId,
    evidenceCategory: evidence.evidenceCategory,
    twinAuthority: evidence.twinAuthority,
    rubricId: evidence.rubricId,
    criteria: evidence.criteria,
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
      previousAction: null,
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
      previousAction: plan.routeChanged ? previousPlan.nextAction : null,
      version: current.version + 1,
      updatedAt: now,
      lastEventId: eventId,
    },
    plan,
  };
}
