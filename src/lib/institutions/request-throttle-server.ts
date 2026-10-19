import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { FirestoreInstitutionRequestThrottle } from "./request-throttle";
export const academyRequestThrottle = new FirestoreInstitutionRequestThrottle(firebaseAdminFirestore);
