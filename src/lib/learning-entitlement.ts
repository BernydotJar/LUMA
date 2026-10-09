import {
  isActiveCommerceEnrollment,
  type CommerceEnrollmentRecord,
} from "./commerce/enrollment";

export type LearningAccessPolicy =
  | { mode: "showcase" }
  | { mode: "entitled"; tenantId: string };

export interface LearningScope {
  tenantId: string;
  programId: string;
}

export interface LearningIdentity {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export interface LearningEntitlementStore {
  listByLearner(learnerId: string): Promise<CommerceEnrollmentRecord[]>;
  claimByEmail(learnerId: string, email: string, tenantId?: string): Promise<CommerceEnrollmentRecord[]>;
}

export function validLearningScopeId(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 && value.length <= 128 &&
    !value.includes("/") && !value.includes("\\") &&
    [...value].every((ch) => ch.charCodeAt(0) >= 32);
}

/**
 * Deployment-level switch; never use untrusted headers to choose the tenant.
 * "showcase" preserves the existing demo, while "entitled" is strictly gated.
 */
export function resolveLearningAccessPolicy(
  environment: Record<string, string | undefined>,
): LearningAccessPolicy {
  const mode = environment.LUMA_LEARNING_ACCESS_MODE === undefined
    ? "showcase"
    : environment.LUMA_LEARNING_ACCESS_MODE;
  if (mode === "showcase") return { mode };
  if (mode !== "entitled") throw new Error("LEARNING_ACCESS_MODE_INVALID");
  const tenantId = environment.LUMA_LEARNING_TENANT_ID?.trim() ?? "";
  if (!validLearningScopeId(tenantId)) {
    throw new Error("LEARNING_ACCESS_TENANT_REQUIRED");
  }
  return { mode, tenantId };
}

/**
 * Select exactly one authorized tenant/program from effective enrollments.
 * Provider details, client-supplied tenant IDs and any global Twin are ignored.
 * First-access email claim is scoped to the deployment tenant.
 */
export async function resolveLearningEntitlement(
  identity: LearningIdentity,
  store: LearningEntitlementStore,
  policy: LearningAccessPolicy,
  requestedProgramId?: string,
  now = new Date().toISOString(),
): Promise<LearningScope | undefined> {
  if (policy.mode === "showcase") return undefined;

  const uid = identity.uid?.trim() ?? "";
  const email = identity.email?.trim().toLowerCase() ?? "";
  if (!uid || !identity.email_verified || !email) {
    throw new Error("LEARNING_VERIFIED_EMAIL_REQUIRED");
  }
  if (requestedProgramId !== undefined && !validLearningScopeId(requestedProgramId)) {
    throw new Error("LEARNING_PROGRAM_INVALID");
  }

  const matching = (records: CommerceEnrollmentRecord[]) =>
    records.filter((record) =>
      record.tenantId === policy.tenantId &&
      record.learnerId === uid &&
      validLearningScopeId(record.programId) &&
      isActiveCommerceEnrollment(record, now),
    );

  let enrollments = matching(await store.listByLearner(uid));
  if (enrollments.length === 0) {
    await store.claimByEmail(uid, email, policy.tenantId);
    enrollments = matching(await store.listByLearner(uid));
  }
  if (enrollments.length === 0) {
    throw new Error("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
  }

  const programs = [...new Set(enrollments.map((record) => record.programId))];
  if (requestedProgramId !== undefined) {
    if (!programs.includes(requestedProgramId)) {
      throw new Error("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    }
    return { tenantId: policy.tenantId, programId: requestedProgramId };
  }
  if (programs.length !== 1) {
    throw new Error("LEARNING_PROGRAM_SELECTION_REQUIRED");
  }
  return { tenantId: policy.tenantId, programId: programs[0] };
}

/** Backwards-compatible admission-only guard used by legacy tests/callers. */
export async function assertLearningEntitlement(
  identity: LearningIdentity,
  store: LearningEntitlementStore,
  policy: LearningAccessPolicy,
  now = new Date().toISOString(),
): Promise<void> {
  await resolveLearningEntitlement(identity, store, policy, undefined, now);
}

export function learningAccessFailure(error: unknown):
  | { status: 400 | 401 | 403 | 409 | 503; error: string }
  | undefined {
  const message = error instanceof Error ? error.message : "";
  if (message === "LEARNING_VERIFIED_EMAIL_REQUIRED") {
    return { status: 403, error: "verified_email_required" };
  }
  if (message === "LEARNING_ACTIVE_ENTITLEMENT_REQUIRED" ||
      message === "ENROLLMENT_ALREADY_CLAIMED") {
    return { status: 403, error: "active_enrollment_required" };
  }
  if (message === "LEARNING_PROGRAM_INVALID") {
    return { status: 400, error: "invalid_program_selection" };
  }
  if (message === "LEARNING_PROGRAM_SELECTION_REQUIRED") {
    return { status: 409, error: "program_selection_required" };
  }
  if (message === "LEARNING_ACCESS_MODE_INVALID" ||
      message === "LEARNING_ACCESS_TENANT_REQUIRED") {
    return { status: 503, error: "learning_access_not_configured" };
  }
  return undefined;
}
