import { firebaseAdminAuth, firebaseAdminFirestore } from "./firebase-admin";
import { FirestoreLearningStore } from "./learning-store";
import { coachAccessHasScope, learningCoachAccessFromClaims } from "./coach-access";

export const learningStore = new FirestoreLearningStore(firebaseAdminFirestore);

export async function requireLearningUser(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("AUTH_REQUIRED");
  }

  const token = authorization.slice("Bearer ".length).trim();
  if (!token) throw new Error("AUTH_REQUIRED");

  return firebaseAdminAuth.verifyIdToken(token);
}

export async function requireLearningCoach(request: Request) {
  const decoded = await requireLearningUser(request);
  const role = typeof decoded.role === "string" ? decoded.role : "";
  const allowed =
    decoded.coach === true ||
    decoded.admin === true ||
    decoded.superuser === true ||
    ["coach", "admin", "superuser"].includes(role);

  if (!allowed) {
    throw new Error("COACH_REQUIRED");
  }

  return decoded;
}

export async function requireLearningAdmin(request: Request) {
  const decoded = await requireLearningUser(request);
  const role = typeof decoded.role === "string" ? decoded.role : "";
  const allowed =
    decoded.admin === true ||
    decoded.superuser === true ||
    ["admin", "superuser"].includes(role);

  if (!allowed) {
    throw new Error("ADMIN_REQUIRED");
  }

  return decoded;
}


export async function requireLearningCoachAccess(request: Request) {
  const decoded = await requireLearningCoach(request);
  const access = learningCoachAccessFromClaims(decoded as Record<string, unknown>);
  if (!coachAccessHasScope(access)) {
    throw new Error("COACH_SCOPE_REQUIRED");
  }
  return { decoded, access };
}
