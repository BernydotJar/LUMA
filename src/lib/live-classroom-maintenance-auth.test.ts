import { describe, expect, it, vi } from "vitest";
import { verifyClassroomMaintenanceCaller } from "./live-classroom-maintenance-auth";

const audience = "https://luma.lch-app.cloud/api/internal/live-classroom/reconcile";
const principal = "live-maintenance@luma-learning-intelligence.iam.gserviceaccount.com";
const request = (token?: string) => new Request(audience, {
  method: "POST",
  ...(token ? { headers: { authorization: "Bearer " + token } } : {}),
});

describe("Scheduler-only live classroom maintenance", () => {
  it("stays closed when no verified Google service identity has been configured", async () => {
    const verify = vi.fn();
    expect(await verifyClassroomMaintenanceCaller(request("jwt"), {
      audience: undefined, principal, verifyToken: verify,
    })).toMatchObject({ ok: false, status: 503 });
    expect(verify).not.toHaveBeenCalled();
  });

  it("denies browser, static secret and blank authorization without querying Google", async () => {
    const verify = vi.fn();
    const config = { audience, principal, verifyToken: verify };
    expect(await verifyClassroomMaintenanceCaller(request(), config))
      .toMatchObject({ ok: false, status: 401 });
    expect(await verifyClassroomMaintenanceCaller(new Request(audience, {
      method: "POST", headers: { authorization: "Basic secret" },
    }), config)).toMatchObject({ ok: false, status: 401 });
    expect(verify).not.toHaveBeenCalled();
  });

  it("verifies an exact audience AND exact service-account principal", async () => {
    const config = {
      audience, principal,
      verifyToken: vi.fn(async () => ({
        iss: "https://accounts.google.com", email: principal, email_verified: true,
      })),
    };
    expect(await verifyClassroomMaintenanceCaller(request("test.jwt.token"), config))
      .toEqual({ ok: true, principal });
    expect(config.verifyToken).toHaveBeenCalledWith("test.jwt.token", audience);
    expect(await verifyClassroomMaintenanceCaller(request("test.jwt.token"), {
      ...config,
      verifyToken: async () => ({
        iss: "https://accounts.google.com",
        email: "unrelated@luma-learning-intelligence.iam.gserviceaccount.com",
        email_verified: true,
      }),
    })).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects wrong issuer, unverified email and invalid Google signature", async () => {
    const base = { audience, principal };
    for (const payload of [
      { iss: "http://evil.example", email: principal, email_verified: true },
      { iss: "https://accounts.google.com", email: principal, email_verified: false },
    ]) {
      expect(await verifyClassroomMaintenanceCaller(request("token"), {
        ...base, verifyToken: async () => payload,
      })).toMatchObject({ ok: false, status: 403 });
    }
    expect(await verifyClassroomMaintenanceCaller(request("token"), {
      ...base, verifyToken: async () => { throw new Error("Invalid OIDC signature"); },
    })).toMatchObject({ ok: false, status: 401 });
  });
});
