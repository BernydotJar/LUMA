import { describe, expect, it } from "vitest";
import { matchesExistingAcademyApplication, parseAcademyApplication } from "./application";
import type { AcademyApplicationRecord } from "./application";

const valid = {
  organizationName: "Academia de Ejemplo", countryCode: "GT",
  timezone: "America/Guatemala", deliveryMode: "hybrid",
  learnerRange: "51-200", contactRole: "owner",
};

describe("secure first academy application validation", () => {
  it("accepts bounded academy metadata without requiring technical tenant identifiers", () => {
    expect(parseAcademyApplication(valid)).toEqual(valid);
  });

  it.each([
    null, [], 23, {},
    { ...valid, admin: true },
    { ...valid, adminTenantIds: ["another-tenant"] },
    { ...valid, tenantId: "other" },
    { ...valid, status: "activated" },
    { ...valid, applicantEmail: "other@example.test" },
    { ...valid, organizationName: "<script>alert(1)</script>" },
    { ...valid, organizationName: " ".repeat(101) },
    { ...valid, organizationName: "  Test  " },
    { ...valid, organizationName: "\nNewline" },
    { ...valid, timezone: "Never/Valid" },
    { ...valid, countryCode: "GT/" },
    { ...valid, deliveryMode: "all" },
    { ...valid, contactRole: "superuser" },
    { ...valid, learnerRange: 5000 },
  ])("rejects privilege escalation, injection and invalid data %#", (input) => {
    expect(() => parseAcademyApplication(input)).toThrow("APPLICATION_INPUT_INVALID");
  });

  it("refuses replay of a modified request instead of replacing a reviewed application", () => {
    const record: AcademyApplicationRecord = {
      ...parseAcademyApplication(valid), applicationId: "hash", applicantUid: "uid",
      applicantEmail: "verified@example.test", status: "received",
      createdAt: "2026-10-14T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z",
    };
    expect(matchesExistingAcademyApplication(record, parseAcademyApplication(valid))).toBe(true);
    expect(matchesExistingAcademyApplication(record, parseAcademyApplication({
      ...valid, organizationName: "Cambio de academia",
    }))).toBe(false);
  });
});
