export interface LearningCoachAccess {
  unrestricted: boolean;
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
  const role = typeof claims.role === "string" ? claims.role : "";
  const unrestricted =
    claims.admin === true ||
    claims.superuser === true ||
    role === "admin" ||
    role === "superuser";

  if (unrestricted) {
    return { unrestricted: true, tenantIds: [], learnerIds: [] };
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
