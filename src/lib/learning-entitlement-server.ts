import { commerceEnrollments } from "./commerce/server";
import {
  assertLearningEntitlement,
  resolveLearningAccessPolicy,
  type LearningIdentity,
} from "./learning-entitlement";

export function isEntitlementAccessRequired(): boolean {
  // Invalid settings are surfaced as service configuration errors, not
  // interpreted as a permissive showcase override.
  return resolveLearningAccessPolicy(process.env).mode === "entitled";
}

export async function requireLearningEntitlement(
  identity: LearningIdentity,
): Promise<void> {
  const policy = resolveLearningAccessPolicy(process.env);
  await assertLearningEntitlement(identity, commerceEnrollments, policy);
}
