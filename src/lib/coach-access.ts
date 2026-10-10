import { authorizedAdminTenants, isInstitutionalAdmin, isPlatformSuperuser } from "./tenant-admin-access";
export interface LearningCoachAccess {
  unrestricted: boolean;
  /** Tenant administrators can manage academic data only within these organizations. */
  institutionalAdmin?: boolean;
  tenantIds: string[];
  learnerIds: string[];
}

function strings(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? [normalized] : [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function learningCoachAccessFromClaims(
  claims: Readonly<Record<string, unknown>>,
): LearningCoachAccess {
  // The platform superuser is the only globally unrestricted role.
  // A tenant administrator must never inherit global coach/learner access.
  if (isPlatformSuperuser(claims)) {
    return { unrestricted: true, tenantIds: [], learnerIds: [] };
  }
  if (isInstitutionalAdmin(claims)) {
    return {
      unrestricted: false,
      institutionalAdmin: true,
      tenantIds: authorizedAdminTenants(claims),
      // Arbitrary learner claims must not expand a tenant administrator's scope.
      learnerIds: [],
    };
  }

  const tenantIds = unique([
    ...strings(claims.tenantId),
    ...strings(claims.tenantIds),
    ...strings(claims.coachTenantIds),
  ]);
  const learnerIds = unique([
    ...strings(claims.learnerIds),
    ...strings(claims.coachLearnerIds),
  ]);

  return { unrestricted: false, tenantIds, learnerIds };
}

export function coachAccessHasScope(access: LearningCoachAccess): boolean {
  return access.unrestricted || access.tenantIds.length > 0 || access.learnerIds.length > 0;
}
