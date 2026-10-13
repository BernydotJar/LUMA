"use client";

import { useEffect } from "react";
import { signInWithEmailAndPassword, signOut } from "@firebase/auth";
import { firebaseAuth, localQaAuthEnabled } from "@/lib/firebase-client";

declare global {
  interface Window {
    __lumaQaAuth?: {
      signIn(email: string, password: string): Promise<string>;
      signOut(): Promise<void>;
      token(): Promise<string | undefined>;
    };
  }
}

/**
 * Invisible emulator-only Playwright bridge. It is not an alternative customer
 * login and is only mounted by a non-production development server using demo-*.
 */
export function QaEmulatorAuth() {
  useEffect(() => {
    if (!localQaAuthEnabled) return;
    window.__lumaQaAuth = {
      async signIn(email, password) {
        const result = await signInWithEmailAndPassword(firebaseAuth, email, password);
        return result.user.uid;
      },
      signOut: async () => signOut(firebaseAuth),
      token: async () => firebaseAuth.currentUser?.getIdToken(),
    };
    return () => { delete window.__lumaQaAuth; };
  }, []);
  return null;
}
