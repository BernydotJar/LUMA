import { validLearningScopeId } from "@/lib/learning-entitlement";

export function isPlatformSuperuser(claims: Record<string, unknown>): boolean {
  return claims.superuser === true || claims.role === "superuser";
}

export function isInstitutionalAdmin(claims: Record<string, unknown>): boolean {
  return isPlatformSuperuser(claims) || claims.admin === true || claims.role === "admin";
}

export function authorizedAdminTenants(claims: Record<string, unknown>): string[] {
  const values = [claims.adminTenantIds, claims.tenantIds, claims.tenantId]
    .flatMap(value => typeof value === "string" ? [value] :
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : []);
  return [...new Set(values.filter(validLearningScopeId))].sort();
}

/** Never treat a tenant-scoped administrator as a platform superuser. */
export function assertTenantAdmin(
  claims: Record<string, unknown>, tenantId: string,
): void {
  if (!validLearningScopeId(tenantId) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(tenantId)) {
    throw new Error("TENANT_ADMIN_SCOPE_INVALID");
  }
  if (isPlatformSuperuser(claims)) return;
  if (!isInstitutionalAdmin(claims)) throw new Error("TENANT_ADMIN_REQUIRED");
  if (!authorizedAdminTenants(claims).includes(tenantId)) {
    throw new Error("TENANT_ADMIN_FORBIDDEN");
  }
}
