import { firebaseAdminFirestore } from "../firebase-admin";
import { institutionPublicationInspector } from "./publication-preflight-server";
import { FirestoreInstitutionPublicationPlanStore } from "./publication-plan-store";

/** Platform-only; remains inert unless the separate plan-admin flag is enabled. */
export const publicationPlanStore = new FirestoreInstitutionPublicationPlanStore(
  firebaseAdminFirestore,
  { inspect: tenantId => institutionPublicationInspector.inspect(tenantId) },
);
