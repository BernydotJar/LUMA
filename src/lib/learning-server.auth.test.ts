import { beforeEach, describe, expect, it, vi } from "vitest";

const verify = vi.hoisted(() => vi.fn());
vi.mock("./firebase-admin", () => ({
  firebaseAdminAuth: { verifyIdToken: verify },
  firebaseAdminFirestore: {},
}));

import {
  requireLearningUser, requireLearningCoach,
  requireLearningAdmin, requireLearningCoachAccess,
} from "./learning-server";

function request(auth = "Bearer valid-firebase-token") {
  return new Request("https://luma.example.org/api/coach/learners", {
    headers: { authorization: auth },
  });
}

describe("Firebase privileged token revocation checks", () => {
  beforeEach(() => verify.mockReset());

  it("checks revocation for admin and coach routes", async () => {
    verify.mockResolvedValue({
      uid: "a", admin: true, adminTenantIds: ["seres"],
    });
    await requireLearningAdmin(request());
    expect(verify).toHaveBeenCalledWith("valid-firebase-token", true);
    verify.mockClear();
    const result = await requireLearningCoachAccess(request());
    expect(verify).toHaveBeenCalledWith("valid-firebase-token", true);
    expect(result.access.unrestricted).toBe(false);
    expect(result.access.tenantIds).toEqual(["seres"]);
    expect(result.access.learnerIds).toEqual([]);
  });

  it("refuses an admin with no tenant claim on all coach data", async () => {
    verify.mockResolvedValue({ uid: "a", role: "admin" });
    await expect(requireLearningCoachAccess(request()))
      .rejects.toThrow("COACH_SCOPE_REQUIRED");
    await expect(requireLearningAdmin(request())).resolves.toMatchObject({ uid: "a" });
  });

  it("allows ordinary learner token verification without privileged fetch", async () => {
    verify.mockResolvedValue({ uid: "learner", email_verified: true });
    await requireLearningUser(request());
    expect(verify).toHaveBeenCalledWith("valid-firebase-token", false);
    await expect(requireLearningCoach(request())).rejects.toThrow("COACH_REQUIRED");
  });

  it("denies missing and malformed bearer tokens before Firebase lookup", async () => {
    await expect(requireLearningAdmin(request("invalid")))
      .rejects.toThrow("AUTH_REQUIRED");
    expect(verify).not.toHaveBeenCalled();
  });
});
