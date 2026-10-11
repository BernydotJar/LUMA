import { firebaseAdminFirestore } from "../firebase-admin";
import { institutionDraftStore } from "../institution-config-server";
import { FirestoreInstitutionPublicationInspector } from "./publication-preflight";
import { FirestoreScopedOfferingReader } from "./offering-reader";

/** Source-only publication readiness inspector; does not activate configurations. */
export const institutionPublicationInspector = new FirestoreInstitutionPublicationInspector(
  { getDraftForTenant: (tenantId: string) => institutionDraftStore.getDraftForTenant(tenantId) },
  new FirestoreScopedOfferingReader(firebaseAdminFirestore),
);
