/** A planning preference only: it is never a Twin signal or a progress event. */
export const WEEKLY_PRACTICE_TARGETS = [2, 3, 4] as const;
export type WeeklyPracticeTarget = (typeof WEEKLY_PRACTICE_TARGETS)[number];
export const DEFAULT_WEEKLY_PRACTICE_TARGET: WeeklyPracticeTarget = 3;

export function parseWeeklyPracticeTarget(raw: string | null): WeeklyPracticeTarget {
  const value = raw === null ? NaN : Number(raw);
  return WEEKLY_PRACTICE_TARGETS.find((target) => target === value) ?? DEFAULT_WEEKLY_PRACTICE_TARGET;
}

/** Do not read or write a preference for anonymous visitors or a previous account. */
export function weeklyPracticeStorageKey(uid: string | null | undefined): string | null {
  if (!uid || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) return null;
  return `luma-weekly-practice-intent:v1:${uid}`;
}
