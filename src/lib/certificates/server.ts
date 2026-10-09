import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { CertificateService } from "./service";

export const certificates = new CertificateService(firebaseAdminFirestore);
