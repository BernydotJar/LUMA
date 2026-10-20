import { firebaseAuth } from "./firebase-client";
import { captureLearnerRequestScope, learnerProgramHeaders, assertLearnerRequestScope } from "./learner-program-request";
import type { StoredLearnerReflection } from "./learning-store";

async function requestReflection(
  method: "GET" | "POST",
  experienceId: string,
  response?: string,
  expected?: { uid: string; programId: string | null },
): Promise<StoredLearnerReflection | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const scope = captureLearnerRequestScope(user.uid, expected?.programId);
  if (expected && scope.uid !== expected.uid) throw new Error("LEARNER_IDENTITY_CHANGED");
  const headers = await learnerProgramHeaders(scope, method === "POST");
  const result = await fetch(
    method === "GET" ? `/api/learning/reflections?experienceId=${encodeURIComponent(experienceId)}` : "/api/learning/reflections",
    {
      method,
      cache: "no-store",
      headers,
      ...(response ? { body: JSON.stringify({ experienceId, response }) } : {}),
    },
  );
  if (!result.ok) throw new Error(`REFLECTION_${method}_FAILED_${result.status}`);
  const payload = (await result.json()) as { reflection: StoredLearnerReflection | null };
  assertLearnerRequestScope(scope);
  return payload.reflection;
}

export const loadLearnerReflection = (experienceId: string, expected?: { uid: string; programId: string | null }) =>
  requestReflection("GET", experienceId, undefined, expected);
export const saveLearnerReflection = (experienceId: string, response: string,
  expected?: { uid: string; programId: string | null }) =>
  requestReflection("POST", experienceId, response, expected);
