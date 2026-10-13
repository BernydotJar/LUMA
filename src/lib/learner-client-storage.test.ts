import { describe, expect, it } from "vitest";
import {
  clearUnscopedLearnerStorage,
  guestLearningKeys,
  legacyUnscopedLearnerKeys,
  pendingLearningKey,
} from "./learner-client-storage";

describe("Learner browser data isolation", () => {
  it("deletes legacy unowned credentials and never migrates a Jeremy grade to Abigail", () => {
    const entries = new Map<string, string>();
    legacyUnscopedLearnerKeys.forEach((key) => entries.set(key, "jeremy-private-data"));
    Object.values(guestLearningKeys).forEach((key) => entries.set(key, "guest-demo"));
    const storage = { removeItem: (key: string) => { entries.delete(key); } };
    clearUnscopedLearnerStorage(storage);
    expect(entries.size).toBe(0);
  });

  it("guest restart keeps public preview but always clears unsafe legacy data", () => {
    const entries = new Map<string, string>([
      [guestLearningKeys.onboarding, "guest-only"],
      ["luma-latest-learning-event", "unknown-owner"],
    ]);
    clearUnscopedLearnerStorage({ removeItem: (key: string) => { entries.delete(key); } }, false);
    expect(entries.get(guestLearningKeys.onboarding)).toBe("guest-only");
    expect(entries.has("luma-latest-learning-event")).toBe(false);
  });

  it("partitions offline pending events by UID and rejects invalid keys", () => {
    expect(pendingLearningKey("jeremy-user")).not.toBe(pendingLearningKey("abigail-user"));
    expect(() => pendingLearningKey("invalid/user")).toThrow("INVALID_LEARNING_STORAGE_OWNER");
  });
});
