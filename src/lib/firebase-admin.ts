import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectId =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "luma-learning-intelligence";

const app =
  getApps()[0] ??
  initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST
      ? { projectId }
      : { credential: applicationDefault(), projectId },
  );

export const firebaseAdminAuth = getAuth(app);
export const firebaseAdminFirestore = getFirestore(app);
