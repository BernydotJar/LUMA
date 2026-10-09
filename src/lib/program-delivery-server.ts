import { firebaseAdminFirestore } from "./firebase-admin";
import { FirestoreProgramDeliveryStore } from "./program-delivery";

export const programDeliveryStore =
  new FirestoreProgramDeliveryStore(firebaseAdminFirestore);
