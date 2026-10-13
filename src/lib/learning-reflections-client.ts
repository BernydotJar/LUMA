import { firebaseAuth } from "./firebase-client";
import type { StoredLearnerReflection } from "./learning-store";

async function requestReflection(
  method: "GET" | "POST",
  experienceId: string,
  response?: string,
): Promise<StoredLearnerReflection | null> {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  const result = await fetch(
    method === "GET" ? `/api/learning/reflections?experienceId=${encodeURIComponent(experienceId)}` : "/api/learning/reflections",
    {
      method,
      cache: "no-store",
      headers: { authorization: `Bearer ${await user.getIdToken()}`, ...(response ? { "content-type": "application/json" } : {}) },
      ...(response ? { body: JSON.stringify({ experienceId, response }) } : {}),
    },
  );
  if (!result.ok) throw new Error(`REFLECTION_${method}_FAILED_${result.status}`);
  return (await result.json() as { reflection: StoredLearnerReflection | null }).reflection;
}

export const loadLearnerReflection = (experienceId: string) => requestReflection("GET", experienceId);
export const saveLearnerReflection = (experienceId: string, response: string) => requestReflection("POST", experienceId, response);
