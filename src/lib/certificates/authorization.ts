import { assertTenantAdmin, isInstitutionalAdmin } from "@/lib/tenant-admin-access";

/** Coaches are scoped by cohort assignment. Admins must also be tenant-scoped. */
export function assertCertificateTenantAccess(
  claims: Record<string, unknown>, tenantId: string,
) {
  if (isInstitutionalAdmin(claims)) assertTenantAdmin(claims, tenantId);
}
