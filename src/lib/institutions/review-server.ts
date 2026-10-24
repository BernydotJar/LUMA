import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { FirestoreAcademyApprovalStore } from "./approval-store";
export const academyApprovalStore = new FirestoreAcademyApprovalStore(firebaseAdminFirestore);
