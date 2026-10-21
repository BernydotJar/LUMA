import { getApps, initializeApp } from "@firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "@firebase/auth";

// QA-only: never connect a production Firebase client to a test Auth emulator.
const qaLocal = process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_LUMA_QA_PROJECT === "demo-luma-live-uat" &&
  process.env.NEXT_PUBLIC_LUMA_QA_AUTH_HOST === "127.0.0.1:9462";

const firebaseConfig = {
  apiKey: "AIzaSyDYpX7onhD24z5_82LssFw3ROZ_TG52rGc",
  authDomain: "luma-learning-intelligence.firebaseapp.com",
  projectId: "luma-learning-intelligence",
  storageBucket: "luma-learning-intelligence.firebasestorage.app",
  messagingSenderId: "161313706596",
  appId: "1:161313706596:web:07ff4e98d7e03d8311c571",
};

export const firebaseApp = getApps()[0] ?? initializeApp(qaLocal ? {
  ...firebaseConfig, apiKey: "demo-key",
  authDomain: "demo-luma-live-uat.firebaseapp.com",
  projectId: "demo-luma-live-uat",
} : firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// A short-lived Playwright QA hook. Available ONLY on the local demo Auth emulator;
// not on production/staging, not on an external host and not in a production build.
if (qaLocal && typeof window !== "undefined" &&
    window.location.hostname === "127.0.0.1" &&
    firebaseApp.options.projectId === "demo-luma-live-uat") {
  if (!firebaseAuth.emulatorConfig) {
    connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9462", { disableWarnings: true });
  }
  Object.defineProperty(window, "__lumaQaEmailSignIn", {
    configurable: true, enumerable: false,
    value: async (email: string, password: string) => {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
    },
  });
}
