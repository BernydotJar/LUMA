import { getApps, initializeApp } from "@firebase/app";
import { connectAuthEmulator, getAuth } from "@firebase/auth";

// Strictly local QA harness. Never initialize the emulator from a production build.
const qaProject = process.env.NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT;
const qaAuthUrl = process.env.NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL;
export const localQaAuthEnabled =
  process.env.NODE_ENV === "development" &&
  Boolean(qaProject?.startsWith("demo-")) &&
  qaAuthUrl === "http://127.0.0.1:9099";

const productionConfig = {
  apiKey: "AIzaSyDYpX7onhD24z5_82LssFw3ROZ_TG52rGc",
  authDomain: "luma-learning-intelligence.firebaseapp.com",
  projectId: "luma-learning-intelligence",
  storageBucket: "luma-learning-intelligence.firebasestorage.app",
  messagingSenderId: "161313706596",
  appId: "1:161313706596:web:07ff4e98d7e03d8311c571",
};

const firebaseConfig = localQaAuthEnabled
  ? {
    ...productionConfig,
    apiKey: "fake-qa-only",
    projectId: qaProject!,
    authDomain: qaProject! + ".firebaseapp.com",
  }
  : productionConfig;

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

if (localQaAuthEnabled && typeof window !== "undefined") {
  connectAuthEmulator(firebaseAuth, qaAuthUrl!, { disableWarnings: true });
}
