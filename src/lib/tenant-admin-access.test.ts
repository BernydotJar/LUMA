import { describe, expect, it } from "vitest";
import { assertTenantAdmin, authorizedAdminTenants, isPlatformSuperuser } from "./tenant-admin-access";
import { assertCertificateTenantAccess } from "./certificates/authorization";

describe("cross-module tenant administrative authority", () => {
  it("never mistakes a tenant admin for an unrestricted superuser", () => {
    const scoped = { admin: true, tenantIds: ["tenant-a"] };
    expect(isPlatformSuperuser(scoped)).toBe(false);
    expect(authorizedAdminTenants(scoped)).toEqual(["tenant-a"]);
    expect(() => assertTenantAdmin(scoped, "tenant-a")).not.toThrow();
    expect(() => assertTenantAdmin(scoped, "tenant-b")).toThrow("TENANT_ADMIN_FORBIDDEN");
    expect(() => assertTenantAdmin({ admin: true }, "tenant-a")).toThrow("TENANT_ADMIN_FORBIDDEN");
    expect(() => assertTenantAdmin({ role: "coach", tenantId: "tenant-a" }, "tenant-a"))
      .toThrow("TENANT_ADMIN_REQUIRED");
    expect(() => assertTenantAdmin({ superuser: true }, "tenant-b")).not.toThrow();
  });
  it("enforces tenant boundaries for all certificate administrative actions", () => {
    expect(() => assertCertificateTenantAccess(
      { admin: true, adminTenantIds: ["tenant-a"] }, "tenant-b",
    )).toThrow("TENANT_ADMIN_FORBIDDEN");
    expect(() => assertCertificateTenantAccess(
      { admin: true, adminTenantIds: ["tenant-a"] }, "tenant-a",
    )).not.toThrow();
    // Coach certificate permission remains governed by cohort assignment in canManageCertificates.
    expect(() => assertCertificateTenantAccess({ role: "coach" }, "tenant-a")).not.toThrow();
    expect(() => assertCertificateTenantAccess({ superuser: true }, "tenant-z")).not.toThrow();
  });
});
