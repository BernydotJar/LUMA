import { getApps, initializeApp } from "@firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "@firebase/auth";

// Only explicit loopback Firebase emulators may be used for synthetic QA.
// Preserve legacy per-program QA while supporting the isolated 3-person AV UAT.
const legacyQaProject = process.env.NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT;
const legacyQaAuthUrl = process.env.NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL;
const legacyQa = process.env.NODE_ENV === "development" &&
  Boolean(legacyQaProject?.startsWith("demo-")) &&
  legacyQaAuthUrl === "http://127.0.0.1:9099";
const liveQa = process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_LUMA_QA_PROJECT === "demo-luma-live-uat" &&
  process.env.NEXT_PUBLIC_LUMA_QA_AUTH_HOST === "127.0.0.1:9462";
export const localQaAuthEnabled = legacyQa || liveQa;
const qaProject = liveQa ? "demo-luma-live-uat" : legacyQaProject;
const qaAuthUrl = liveQa ? "http://127.0.0.1:9462" : legacyQaAuthUrl;

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
    apiKey: liveQa ? "demo-key" : "fake-qa-only",
    projectId: qaProject!,
    authDomain: qaProject! + ".firebaseapp.com",
  }
  : productionConfig;

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

if (localQaAuthEnabled && typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname) &&
    firebaseApp.options.projectId === qaProject) {
  if (!firebaseAuth.emulatorConfig) {
    connectAuthEmulator(firebaseAuth, qaAuthUrl!, { disableWarnings: true });
  }
  // QA login hook exists only in the exact local demo UAT fixture, not prod.
  if (liveQa && window.location.hostname === "127.0.0.1") {
    Object.defineProperty(window, "__lumaQaEmailSignIn", {
      configurable: true,
      enumerable: false,
      value: async (email: string, password: string) => {
        if (!firebaseAuth.emulatorConfig ||
            firebaseApp.options.projectId !== "demo-luma-live-uat") {
          throw new Error("LUMA_QA_AUTH_EMULATOR_REQUIRED");
        }
        await signInWithEmailAndPassword(firebaseAuth, email, password);
      },
    });
  }
}
