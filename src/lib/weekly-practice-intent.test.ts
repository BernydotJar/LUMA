import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEEKLY_PRACTICE_TARGET,
  parseWeeklyPracticeTarget,
  weeklyPracticeStorageKey,
} from "./weekly-practice-intent";

describe("weekly practice planning preference", () => {
  it("accepts only bounded choices; neither local data nor minutes become mastery evidence", () => {
    expect(["2", "3", "4"].map(parseWeeklyPracticeTarget)).toEqual([2, 3, 4]);
    for (const raw of [null, "0", "5", "100", "-1", "1.5", "NaN", "", "null", "{}"])
      expect(parseWeeklyPracticeTarget(raw)).toBe(DEFAULT_WEEKLY_PRACTICE_TARGET);
  });

  it("requires a valid account identity and separates users on the same device", () => {
    expect(weeklyPracticeStorageKey(null)).toBeNull();
    expect(weeklyPracticeStorageKey("")).toBeNull();
    expect(weeklyPracticeStorageKey("../other-user")).toBeNull();
    expect(weeklyPracticeStorageKey("a".repeat(129))).toBeNull();
    expect(weeklyPracticeStorageKey("student_A")).not.toBe(weeklyPracticeStorageKey("student_B"));
  });
});
