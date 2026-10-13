import { firebaseAuth } from "./firebase-client";
import { pendingLearningKey, sameLearningScope, type PendingLearningScope } from "./learner-client-storage";
import type {
  AdaptiveLearningPlan,
  StoredLearningEvent,
  StoredOnboardingState,
} from "./learner-projection";

export function hasPersistentLearningSession() {
  return Boolean(firebaseAuth.currentUser);
}

async function authHeaders(expectedUid?: string): Promise<Record<string, string> | undefined> {
  const user = firebaseAuth.currentUser;
  if (!user) return undefined;
  if (expectedUid && user.uid !== expectedUid) throw new Error("LEARNER_IDENTITY_CHANGED");
  const token = await user.getIdToken();
  // Account switches during async token retrieval must fail closed.
  if (firebaseAuth.currentUser?.uid !== user.uid) throw new Error("LEARNER_IDENTITY_CHANGED");
  return {
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

export interface PersistentLearningSnapshot {
  plan: AdaptiveLearningPlan;
  onboarding: StoredOnboardingState;
  scoredEvidence: StoredLearningEvent | null;
  program: { tenantId: string; programId: string } | null;
}

/** Scoped server projection. Never restore an authenticated learner from localStorage. */
export async function fetchPersistentLearningSnapshot(): Promise<PersistentLearningSnapshot | undefined> {
  const headers = await authHeaders();
  if (!headers) return undefined;

  const response = await fetch("/api/learning/plan", {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`PLAN_FETCH_FAILED_${response.status}`);
  return (await response.json()) as PersistentLearningSnapshot;
}

export async function fetchPersistentLearningPlan(): Promise<AdaptiveLearningPlan | undefined> {
  return (await fetchPersistentLearningSnapshot())?.plan;
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
  ownership: { uid: string; program: PendingLearningScope },
): Promise<AdaptiveLearningPlan | undefined> {
  const headers = await authHeaders(ownership.uid);
  if (!headers) throw new Error("LEARNER_IDENTITY_CHANGED");
  if (ownership.program) headers["x-luma-program-id"] = ownership.program.programId;

  const response = await fetch("/api/learning/events", {
    method: "POST",
    headers,
    body: JSON.stringify({ eventId, event }),
  });

  if (!response.ok) throw new Error(`EVENT_APPEND_FAILED_${response.status}`);
  const body = (await response.json()) as { plan: AdaptiveLearningPlan };
  return body.plan;
}

export async function syncPendingLearningEvent(
  snapshot: PersistentLearningSnapshot,
  expectedUid: string,
): Promise<AdaptiveLearningPlan | undefined> {
  if (typeof window === "undefined" || firebaseAuth.currentUser?.uid !== expectedUid) return undefined;
  // The snapshot was obtained from a server-entitled program, never localStorage.
  const key = pendingLearningKey(expectedUid, snapshot.program);
  const raw = window.localStorage.getItem(key);
  if (!raw) return undefined;

  let pending: {
    ownerUid: string;
    program: PendingLearningScope;
    eventId: string;
    event: StoredLearningEvent;
  };
  try {
    pending = JSON.parse(raw) as typeof pending;
  } catch {
    window.localStorage.removeItem(key);
    return undefined;
  }

  if (!pending || pending.ownerUid !== expectedUid ||
      !sameLearningScope(pending.program, snapshot.program) ||
      typeof pending.eventId !== "string" || !pending.event) {
    window.localStorage.removeItem(key);
    return undefined;
  }
  if (firebaseAuth.currentUser?.uid !== expectedUid) return undefined;
  const plan = await appendPersistentLearningEvent(
    pending.eventId, pending.event,
    { uid: expectedUid, program: snapshot.program },
  );
  if (plan) window.localStorage.removeItem(key);
  return plan;
}
