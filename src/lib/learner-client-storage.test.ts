import { describe, expect, it } from "vitest";
import {
  clearUnscopedLearnerStorage,
  guestLearningKeys,
  legacyUnscopedLearnerKeys,
  pendingLearningKey,
  sameLearningScope,
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

  it("partitions retries by UID, tenant and program and rejects invalid identifiers", () => {
    const courseA = { tenantId: "institution-one", programId: "practitioner" };
    const courseB = { tenantId: "institution-one", programId: "master" };
    const tenantB = { tenantId: "institution-two", programId: "practitioner" };
    const jeremy = pendingLearningKey("jeremy-user", courseA);
    expect(jeremy).not.toBe(pendingLearningKey("abigail-user", courseA));
    expect(jeremy).not.toBe(pendingLearningKey("jeremy-user", courseB));
    expect(jeremy).not.toBe(pendingLearningKey("jeremy-user", tenantB));
    expect(jeremy).not.toBe(pendingLearningKey("jeremy-user", null));
    expect(sameLearningScope(courseA, courseA)).toBe(true);
    expect(sameLearningScope(courseA, courseB)).toBe(false);
    expect(sameLearningScope(courseA, tenantB)).toBe(false);
    expect(sameLearningScope(null, courseA)).toBe(false);
    expect(sameLearningScope(null, null)).toBe(true);
    expect(() => pendingLearningKey("invalid/user", courseA)).toThrow("INVALID_LEARNING_STORAGE_OWNER");
    expect(() => pendingLearningKey("jeremy-user", { ...courseA, programId: "bad/course" }))
      .toThrow("INVALID_LEARNING_STORAGE_SCOPE");
  });
});
