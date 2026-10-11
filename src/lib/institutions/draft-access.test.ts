import { describe, expect, it } from "vitest";
import { assertInstitutionDraftAdmin } from "./draft-access";

describe("strict institution draft administration", () => {
  it("permits a verified dedicated admin for its exact tenant", () => {
    expect(() => assertInstitutionDraftAdmin({ admin: true, adminTenantIds: ["tenant-a"] }, "tenant-a"))
      .not.toThrow();
    expect(() => assertInstitutionDraftAdmin({ role: "superuser" }, "tenant-a"))
      .not.toThrow();
  });
  it("does not interpret learner/coach scopes as institutional admin rights", () => {
    expect(() => assertInstitutionDraftAdmin({ admin: true, tenantIds: ["tenant-a"] }, "tenant-a"))
      .toThrow("INSTITUTION_DRAFT_ADMIN_SCOPE_REQUIRED");
    expect(() => assertInstitutionDraftAdmin({ admin: true, tenantId: "tenant-a" }, "tenant-a"))
      .toThrow("INSTITUTION_DRAFT_ADMIN_SCOPE_REQUIRED");
    expect(() => assertInstitutionDraftAdmin({ coach: true, tenantIds: ["tenant-a"] }, "tenant-a"))
      .toThrow("INSTITUTION_DRAFT_ADMIN_REQUIRED");
  });
  it("treats an empty dedicated scope as definitive revocation", () => {
    expect(() => assertInstitutionDraftAdmin({ admin: true, adminTenantIds: [], tenantIds: ["tenant-a"] }, "tenant-a"))
      .toThrow("INSTITUTION_DRAFT_ADMIN_FORBIDDEN");
  });
  it("rejects requests for another institution even when legacy assignments exist", () => {
    expect(() => assertInstitutionDraftAdmin({ admin: true, adminTenantIds: ["tenant-b"], tenantIds: ["tenant-a"] }, "tenant-a"))
      .toThrow("INSTITUTION_DRAFT_ADMIN_FORBIDDEN");
    expect(() => assertInstitutionDraftAdmin({ admin: true, adminTenantIds: ["tenant-a"] }, "../tenant-a"))
      .toThrow("INSTITUTION_DRAFT_TENANT_INVALID");
  });
});
