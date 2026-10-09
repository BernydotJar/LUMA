import { describe, expect, it } from "vitest";
import { isRejectedFirebaseToken } from "./auth-token-error";

describe("live agenda Firebase token response classification", () => {
  it("returns 401 for expired, revoked, invalid or malformed credentials", () => {
    for (const code of [
      "auth/invalid-id-token",
      "auth/id-token-expired",
      "auth/id-token-revoked",
      "auth/argument-error",
    ]) {
      expect(isRejectedFirebaseToken({ code })).toBe(true);
    }
  });
  it("retains HTTP 500 for service and infrastructure failures", () => {
    for (const error of [
      new Error("firestore unavailable"),
      { code: "auth/internal-error" },
      { code: "auth/network-request-failed" },
      { code: 401 },
      null,
    ]) {
      expect(isRejectedFirebaseToken(error)).toBe(false);
    }
  });
});
