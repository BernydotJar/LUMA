import { commerceEnrollments } from "./commerce/server";
import {
  resolveLearningEntitlement,
  resolveLearningAccessPolicy,
  type LearningIdentity,
  type LearningScope,
} from "./learning-entitlement";

export function isEntitlementAccessRequired(): boolean {
  return resolveLearningAccessPolicy(process.env).mode === "entitled";
}

/** Server-side program selection is always checked against the learner's own purchase. */
export async function requireLearningEntitlement(
  identity: LearningIdentity,
  requestedProgramId?: string | null,
): Promise<LearningScope | undefined> {
  const policy = resolveLearningAccessPolicy(process.env);
  const programId = requestedProgramId ??
    (policy.mode === "entitled" ? process.env.LUMA_LEARNING_PROGRAM_ID : undefined);
  return resolveLearningEntitlement(identity, commerceEnrollments, policy, programId);
}
