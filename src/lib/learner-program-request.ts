import { firebaseAuth } from "./firebase-client";
import { readSelectedProgram } from "./program-selection";

/** A client-side selection is never an entitlement: each server route verifies it. */
export interface LearnerRequestScope { uid: string; programId: string | null }

export function captureLearnerRequestScope(uid: string, verifiedProgram?: string | null): LearnerRequestScope {
  if (!uid || firebaseAuth.currentUser?.uid !== uid) throw new Error("LEARNER_IDENTITY_CHANGED");
  const selected = readSelectedProgram("learner", uid);
  if (verifiedProgram !== undefined && verifiedProgram !== selected) throw new Error("LEARNER_PROGRAM_CHANGED");
  return { uid, programId: selected };
}

export function assertLearnerRequestScope(scope: LearnerRequestScope): void {
  if (firebaseAuth.currentUser?.uid !== scope.uid) throw new Error("LEARNER_IDENTITY_CHANGED");
  if (readSelectedProgram("learner", scope.uid) !== scope.programId) {
    throw new Error("LEARNER_PROGRAM_CHANGED");
  }
}

/** Rejects account/course changes across getIdToken and completion of async reads/writes. */
export async function learnerProgramHeaders(scope: LearnerRequestScope, json = false): Promise<Record<string, string>> {
  assertLearnerRequestScope(scope);
  const current = firebaseAuth.currentUser;
  if (!current) throw new Error("LEARNER_IDENTITY_CHANGED");
  const token = await current.getIdToken();
  assertLearnerRequestScope(scope);
  return {
    authorization: `Bearer ${token}`,
    ...(scope.programId ? { "x-luma-program-id": scope.programId } : {}),
    ...(json ? { "content-type": "application/json" } : {}),
  };
}
