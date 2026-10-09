import { firebaseAuth } from "./firebase-client";
import type { AdaptiveLearningPlan } from "./learner-projection";
import type { PersistedLearnerRecord } from "./persistent-learning";

export interface CoachLearnerSummary {
  learnerId: string;
  goal: string;
  nextActionTitle: string;
  nextActionId: string;
  version: number;
  updatedAt: string;
}

export interface CoachInterventionSignal {
  learnerId: string;
  priority: "low" | "medium" | "high";
  score: number;
  inactivityDays: number;
  averageMastery: number;
  completionRate: number;
  maxConsecutiveFailures: number;
  reasons: string[];
  recommendation: string;
  updatedAt: string;
}

export interface CoachLearnerDetail {
  record: PersistedLearnerRecord;
  plan: AdaptiveLearningPlan;
  events: Array<Record<string, unknown>>;
}

async function coachHeaders(): Promise<HeadersInit | undefined> {
  const user = firebaseAuth.currentUser;
  if (!user) return undefined;
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

export async function fetchCoachLearners(): Promise<CoachLearnerSummary[] | undefined> {
  const headers = await coachHeaders();
  if (!headers) return undefined;

  const response = await fetch("/api/coach/learners", { headers, cache: "no-store" });
  if (response.status === 401 || response.status === 403) return undefined;
  if (!response.ok) throw new Error(`COACH_LEARNERS_FAILED_${response.status}`);

  const body = (await response.json()) as { learners: CoachLearnerSummary[] };
  return body.learners;
}

export async function fetchCoachLearner(
  learnerId: string,
): Promise<CoachLearnerDetail | undefined> {
  const headers = await coachHeaders();
  if (!headers) return undefined;

  const response = await fetch(`/api/coach/learners/${encodeURIComponent(learnerId)}`, {
    headers,
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403 || response.status === 404) return undefined;
  if (!response.ok) throw new Error(`COACH_LEARNER_FAILED_${response.status}`);

  return response.json();
}


export async function fetchCoachInterventions(): Promise<CoachInterventionSignal[] | undefined> {
  const headers = await coachHeaders();
  if (!headers) return undefined;

  const response = await fetch("/api/coach/interventions", { headers, cache: "no-store" });
  if (response.status === 401 || response.status === 403) return undefined;
  if (!response.ok) throw new Error(`COACH_INTERVENTIONS_FAILED_${response.status}`);

  const body = (await response.json()) as { interventions: CoachInterventionSignal[] };
  return body.interventions;
}
