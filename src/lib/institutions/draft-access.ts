import { authorizedAdminTenants, isInstitutionalAdmin, isPlatformSuperuser } from "../tenant-admin-access";
import { parseDraftTenantId } from "./draft-input";

/**
 * Saas draft administration is stricter than legacy showcase administration:
 * tenantIds/tenantId from coach/learner scopes are NOT acceptable here.
 * Only dedicated adminTenantIds or true platform-superuser authority qualifies.
 */
export function assertInstitutionDraftAdmin(
  claims: Record<string, unknown>,
  tenantId: string,
): void {
  parseDraftTenantId(tenantId);
  if (isPlatformSuperuser(claims)) return;
  if (!isInstitutionalAdmin(claims)) throw new Error("INSTITUTION_DRAFT_ADMIN_REQUIRED");
  if (!Object.prototype.hasOwnProperty.call(claims, "adminTenantIds")) {
    throw new Error("INSTITUTION_DRAFT_ADMIN_SCOPE_REQUIRED");
  }
  if (!authorizedAdminTenants(claims).includes(tenantId)) {
    throw new Error("INSTITUTION_DRAFT_ADMIN_FORBIDDEN");
  }
}
