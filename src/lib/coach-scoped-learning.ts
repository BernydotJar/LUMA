import type { CommerceEnrollmentRecord } from "./commerce/enrollment";
import { isActiveCommerceEnrollment } from "./commerce/enrollment";
import type { LearningCoachAccess } from "./coach-access";
import {
  resolveLearningAccessPolicy,
  validLearningScopeId,
  type LearningScope,
} from "./learning-entitlement";

export interface CoachEnrollmentReader {
  listByLearner(uid: string): Promise<CommerceEnrollmentRecord[]>;
  sampleActiveLearnerIdsByTenants(tenantIds: string[], limit: number): Promise<string[]>;
}

/**
 * Strict coach reads select ONE tenant/program, and the requested program is
 * not trusted without checking the actual enrollment at the read boundary.
 */
export function resolveCoachLearningScope(
  access: LearningCoachAccess,
  headers: Pick<Headers, "get">,
  environment: Record<string, string | undefined> = process.env,
): LearningScope | undefined {
  const policy = resolveLearningAccessPolicy(environment);
  if (policy.mode === "showcase") return undefined;

  if (!access.unrestricted &&
      !access.tenantIds.includes(policy.tenantId) &&
      access.learnerIds.length === 0) {
    throw new Error("COACH_SCOPE_REQUIRED");
  }
  const programId = headers.get("x-luma-program-id") ??
    environment.LUMA_LEARNING_PROGRAM_ID;
  if (!programId || !validLearningScopeId(programId)) {
    throw new Error("LEARNING_PROGRAM_SELECTION_REQUIRED");
  }
  return { tenantId: policy.tenantId, programId };
}

export function coachCanReadEnrollment(
  access: LearningCoachAccess,
  scope: LearningScope,
  enrollment: CommerceEnrollmentRecord,
  learnerId: string,
  now = new Date().toISOString(),
): boolean {
  return (access.unrestricted ||
    access.tenantIds.includes(scope.tenantId) ||
    access.learnerIds.includes(learnerId)) &&
    enrollment.tenantId === scope.tenantId &&
    enrollment.programId === scope.programId &&
    enrollment.learnerId === learnerId &&
    isActiveCommerceEnrollment(enrollment, now);
}

export async function assertScopedCoachLearner(
  access: LearningCoachAccess,
  scope: LearningScope,
  learnerId: string,
  enrollmentStore: CoachEnrollmentReader,
  now = new Date().toISOString(),
): Promise<void> {
  const records = await enrollmentStore.listByLearner(learnerId);
  if (!records.some((record) => coachCanReadEnrollment(
    access, scope, record, learnerId, now,
  ))) throw new Error("COACH_LEARNER_SCOPE_FORBIDDEN");
}

/** Bounded sampling: a candidate UID still requires program-scoped entitlement. */
export async function listScopedCoachLearnerIds(
  access: LearningCoachAccess,
  scope: LearningScope,
  enrollmentStore: CoachEnrollmentReader,
  limit: number,
): Promise<string[]> {
  const max = Math.min(Math.max(1, Math.trunc(limit)), 100);
  const explicit = [...new Set(access.learnerIds)].slice(0, max);
  const sampled = await enrollmentStore.sampleActiveLearnerIdsByTenants(
    [scope.tenantId], max,
  );
  const ids = [...new Set([...explicit, ...sampled])].slice(0, max);
  const matches = await Promise.all(ids.map(async (uid) => {
    const records = await enrollmentStore.listByLearner(uid);
    return records.some((record) => coachCanReadEnrollment(
      access, scope, record, uid,
    )) ? uid : undefined;
  }));
  return matches.filter((id): id is string => Boolean(id));
}
