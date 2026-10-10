import { validLearningScopeId } from "@/lib/learning-entitlement";

export function isPlatformSuperuser(claims: Record<string, unknown>): boolean {
  return claims.superuser === true || claims.role === "superuser";
}

export function isInstitutionalAdmin(claims: Record<string, unknown>): boolean {
  return isPlatformSuperuser(claims) || claims.admin === true || claims.role === "admin";
}

export function authorizedAdminTenants(claims: Record<string, unknown>): string[] {
  // The dedicated role assignment is authoritative when provisioned, including
  // [] after revocation. Do not expand admin authority using learner/coach scopes.
  const explicit = Object.prototype.hasOwnProperty.call(claims, "adminTenantIds");
  const values = explicit
    ? [claims.adminTenantIds]
    : [claims.tenantIds, claims.tenantId]; // legacy Firebase admin claims only
  const scopes = values.flatMap(value => typeof value === "string" ? [value] :
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string") : []);
  return [...new Set(scopes.filter(value =>
    validLearningScopeId(value) && /^[A-Za-z0-9_-]{1,128}$/.test(value),
  ))].sort();
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
