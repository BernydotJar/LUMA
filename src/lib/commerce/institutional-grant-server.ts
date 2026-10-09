import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { FirestoreInstitutionalGrantStore } from "./institutional-grant-store";

export const institutionalGrants = new FirestoreInstitutionalGrantStore(firebaseAdminFirestore);
