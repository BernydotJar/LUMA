import { firebaseAdminAuth, firebaseAdminFirestore } from "./firebase-admin";
import { FirestoreLearningStore } from "./learning-store";

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
