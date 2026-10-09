import {
  isActiveCommerceEnrollment,
  type CommerceEnrollmentRecord,
} from "./commerce/enrollment";

export type LearningAccessPolicy =
  | { mode: "showcase" }
  | { mode: "entitled"; tenantId: string };

export interface LearningIdentity {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

export interface LearningEntitlementStore {
  listByLearner(learnerId: string): Promise<CommerceEnrollmentRecord[]>;
  claimByEmail(learnerId: string, email: string, tenantId?: string): Promise<CommerceEnrollmentRecord[]>;
}

/**
 * Explicit deployment-wide policy: preserve the existing open showcase until
 * a tenant-specific pilot is configured. An invalid or incomplete strict
 * configuration always fails closed. Never select tenant using request input.
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
  if (!tenantId || tenantId.length > 128 || tenantId.includes("/") || tenantId.includes("\\") || [...tenantId].some((char) => char.charCodeAt(0) < 32)) {
    throw new Error("LEARNING_ACCESS_TENANT_REQUIRED");
  }
  return { mode, tenantId };
}

/**
 * The same effective entitlement predicate applies to either payment provider.
 * The verified email claim is the existing identity bridge; replays are already
 * deduplicated by FirestoreCommerceEnrollmentStore.
 *
 * A purchase never creates an artificial Learning Twin: this guard authorizes
 * the learner to perform authenticated onboarding and evaluated practice.
 */
export async function assertLearningEntitlement(
  identity: LearningIdentity,
  store: LearningEntitlementStore,
  policy: LearningAccessPolicy,
  now = new Date().toISOString(),
): Promise<void> {
  if (policy.mode === "showcase") return;
  const uid = identity.uid?.trim() ?? "";
  const email = identity.email?.trim().toLowerCase() ?? "";
  if (!uid || !identity.email_verified || !email) {
    throw new Error("LEARNING_VERIFIED_EMAIL_REQUIRED");
  }

  const active = (records: CommerceEnrollmentRecord[]) =>
    records.some((record) =>
      record.tenantId === policy.tenantId &&
      record.learnerId === uid &&
      isActiveCommerceEnrollment(record, now),
    );

  if (active(await store.listByLearner(uid))) return;

  // Newly paid customer may not have claimed their provider enrollment yet.
  await store.claimByEmail(uid, email, policy.tenantId);
  if (!active(await store.listByLearner(uid))) {
    throw new Error("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
  }
}

export function learningAccessFailure(error: unknown):
  | { status: 401 | 403 | 503; error: string }
  | undefined {
  const message = error instanceof Error ? error.message : "";
  if (message === "LEARNING_VERIFIED_EMAIL_REQUIRED") {
    return { status: 403, error: "verified_email_required" };
  }
  if (message === "LEARNING_ACTIVE_ENTITLEMENT_REQUIRED" ||
      message === "ENROLLMENT_ALREADY_CLAIMED") {
    return { status: 403, error: "active_enrollment_required" };
  }
  if (message === "LEARNING_ACCESS_MODE_INVALID" ||
      message === "LEARNING_ACCESS_TENANT_REQUIRED") {
    return { status: 503, error: "learning_access_not_configured" };
  }
  return undefined;
}
