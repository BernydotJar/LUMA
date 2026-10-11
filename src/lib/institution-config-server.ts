import { firebaseAdminFirestore } from "./firebase-admin";
import { FirestoreInstitutionDraftStore } from "./institutions/draft-store";

/** Admin-only draft editing; never a provider for entitled learner resolution. */
export const institutionDraftStore = new FirestoreInstitutionDraftStore(firebaseAdminFirestore);
