/**
 * Local data is never authoritative for authenticated learner achievements.
 * Guest previews live in a separate namespace. Authenticated pending writes
 * are scoped to the Firebase UID; their server-side entitlement is rechecked.
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

export function pendingLearningKey(uid: string): string {
  if (!uid || uid.length > 256 || /[/\\]/.test(uid)) {
    throw new Error("INVALID_LEARNING_STORAGE_OWNER");
  }
  return `luma-learner-pending:v2:${encodeURIComponent(uid)}`;
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
