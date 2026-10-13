/**
 * Local data is never authoritative for authenticated learner achievements.
 * Guest previews live in a separate namespace. Authenticated pending writes
 * are scoped to the Firebase UID and verified program; the server rechecks
 * active enrollment before accepting any replay.
 */
export const guestLearningKeys = {
  onboarding: "luma-guest-onboarding",
  latestScored: "luma-guest-latest-scored-event",
} as const;

export const legacyUnscopedLearnerKeys = [
  "luma-onboarding",
  "luma-latest-learning-event",
  "luma-pending-learning-event",
  "luma-learning-events",
] as const;

/** Null only in explicit showcase mode; not a missing entitlement. */
export type PendingLearningScope = { tenantId: string; programId: string } | null;

function validSegment(input: string, max = 128): boolean {
  return Boolean(input) && input.length <= max &&
    !/[/\\]/.test(input) && !/[\u0000-\u001f]/.test(input);
}

/** Never read or replay a pending event without a server-confirmed scope. */
export function pendingLearningKey(uid: string, scope: PendingLearningScope): string {
  if (!validSegment(uid, 256)) throw new Error("INVALID_LEARNING_STORAGE_OWNER");
  if (scope && (!validSegment(scope.tenantId) || !validSegment(scope.programId))) {
    throw new Error("INVALID_LEARNING_STORAGE_SCOPE");
  }
  const owner = encodeURIComponent(uid);
  const program = scope
    ? `program:${encodeURIComponent(scope.tenantId)}:${encodeURIComponent(scope.programId)}`
    : "showcase";
  return `luma-learner-pending:v3:${owner}:${program}`;
}

export function sameLearningScope(a: PendingLearningScope, b: PendingLearningScope): boolean {
  return a === null && b === null || Boolean(a && b &&
    a.tenantId === b.tenantId && a.programId === b.programId);
}

export function clearUnscopedLearnerStorage(storage: Pick<Storage, "removeItem">, authenticated = true) {
  for (const key of [...legacyUnscopedLearnerKeys, ...(authenticated ? Object.values(guestLearningKeys) : [])]) {
    storage.removeItem(key);
  }
}

/** A plain callback for AuthProvider. Never migrate unverifiable legacy data. */
export function discardLegacyLearnerData(authenticated: boolean) {
  if (typeof window === "undefined") return;
  try {
    clearUnscopedLearnerStorage(window.localStorage, authenticated);
    window.dispatchEvent(new Event("storage"));
  } catch {
    // Private browsing can disable storage; no learner data is trusted if so.
  }
}
