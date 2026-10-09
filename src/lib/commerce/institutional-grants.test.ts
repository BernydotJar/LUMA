import { describe, expect, it } from "vitest";
import {
  authorizeInstitutionalAdmin, enrollmentIdForGrant,
  parseInstitutionalGrant, parseInstitutionalRevocationReason,
} from "./institutional-grants";

const now = Date.parse("2026-10-09T12:00:00Z");
const request = {
  tenantId: "seres", programId: "leadership",
  offeringId: "cohort-2026", email: "Student@Example.org",
  reason: "Authorized corporate program participation, approved by administration.",
  expiresAt: "2027-10-01T00:00:00Z",
};
describe("institutional enrollment validations", () => {
  it("normalizes approved institutional grants and assigns deterministic tenant-bound IDs", () => {
    const grant = parseInstitutionalGrant(request, now);
    expect(grant.email).toBe("student@example.org");
    expect(grant.allowReactivation).toBe(false);
    expect(grant.expiresAt).toBe("2027-10-01T00:00:00.000Z");
    expect(enrollmentIdForGrant(grant)).toMatch(/^[a-f0-9]{64}$/);
    expect(enrollmentIdForGrant(grant)).toBe(enrollmentIdForGrant(grant));
    expect(enrollmentIdForGrant(grant)).not.toBe(enrollmentIdForGrant({
      ...grant, tenantId: "other-tenant",
    }));
  });
  it("rejects invalid scope, addresses, reasons, and unbounded access", () => {
    for (const candidate of [
      { tenantId: "../seres" }, { programId: "" },
      { offeringId: "a/b" }, { email: "bad" },
      { reason: "free" }, { expiresAt: "2025-01-01T00:00:00Z" },
      { expiresAt: "2040-10-01T00:00:00Z" },
      { expiresAt: "2027-10-01" },
      { allowReactivation: "yes" },
    ]) expect(() => parseInstitutionalGrant({
      ...request, ...candidate,
    }, now)).toThrow();
    expect(() => parseInstitutionalRevocationReason("x")).toThrow();
  });
  it("allows scoped admins for their own tenant only and superuser globally", () => {
    expect(() => authorizeInstitutionalAdmin({ admin: true, adminTenantIds: ["seres"] }, "seres"))
      .not.toThrow();
    expect(() => authorizeInstitutionalAdmin({ admin: true, tenantId: "seres" }, "other"))
      .toThrow("INSTITUTIONAL_TENANT_FORBIDDEN");
    expect(() => authorizeInstitutionalAdmin({ admin: true }, "seres"))
      .toThrow("INSTITUTIONAL_TENANT_FORBIDDEN");
    expect(() => authorizeInstitutionalAdmin({ coach: true, tenantId: "seres" }, "seres"))
      .toThrow("INSTITUTIONAL_ADMIN_REQUIRED");
    expect(() => authorizeInstitutionalAdmin({ superuser: true }, "seres")).not.toThrow();
    expect(() => authorizeInstitutionalAdmin({ superuser: true }, "../seres")).toThrow();
  });
});
