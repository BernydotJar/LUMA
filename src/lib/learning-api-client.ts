import { firebaseAuth } from "./firebase-client";
import type {
  AdaptiveLearningPlan,
  StoredLearningEvent,
  StoredOnboardingState,
} from "./learner-projection";

export function hasPersistentLearningSession() {
  return Boolean(firebaseAuth.currentUser);
}

async function authHeaders(): Promise<HeadersInit | undefined> {
  const user = firebaseAuth.currentUser;
  if (!user) return undefined;

  return {
    "content-type": "application/json",
    authorization: `Bearer ${await user.getIdToken()}`,
  };
}

export async function fetchPersistentLearningPlan(): Promise<AdaptiveLearningPlan | undefined> {
  const headers = await authHeaders();
  if (!headers) return undefined;

  const response = await fetch("/api/learning/plan", {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`PLAN_FETCH_FAILED_${response.status}`);

  const body = (await response.json()) as { plan: AdaptiveLearningPlan };
  return body.plan;
}

export async function bootstrapPersistentLearningPlan(
  onboarding: StoredOnboardingState,
): Promise<AdaptiveLearningPlan | undefined> {
  const headers = await authHeaders();
  if (!headers) return undefined;

  const response = await fetch("/api/learning/plan", {
    method: "PUT",
    headers,
    body: JSON.stringify({ onboarding }),
  });

  if (!response.ok) throw new Error(`PLAN_BOOTSTRAP_FAILED_${response.status}`);
  const body = (await response.json()) as { plan: AdaptiveLearningPlan };
  return body.plan;
}

export async function appendPersistentLearningEvent(
  eventId: string,
  event: StoredLearningEvent,
): Promise<AdaptiveLearningPlan | undefined> {
  const headers = await authHeaders();
  if (!headers) return undefined;

  const response = await fetch("/api/learning/events", {
    method: "POST",
    headers,
    body: JSON.stringify({ eventId, event }),
  });

  if (!response.ok) throw new Error(`EVENT_APPEND_FAILED_${response.status}`);
  const body = (await response.json()) as { plan: AdaptiveLearningPlan };
  return body.plan;
}

export async function syncPendingLearningEvent(): Promise<AdaptiveLearningPlan | undefined> {
  if (typeof window === "undefined") return undefined;
  const raw = window.localStorage.getItem("luma-pending-learning-event");
  if (!raw) return undefined;

  const pending = JSON.parse(raw) as { eventId: string; event: StoredLearningEvent };
  const plan = await appendPersistentLearningEvent(pending.eventId, pending.event);
  if (plan) window.localStorage.removeItem("luma-pending-learning-event");
  return plan;
}
