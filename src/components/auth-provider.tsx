"use client";

import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "@firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { firebaseAuth } from "@/lib/firebase-client";
import { sanitizePreferredName } from "@/lib/profile-name";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
      // The Firebase SDK still maintains the current session when persistence is unavailable.
    });

    return onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      await signInWithPopup(firebaseAuth, provider);
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";

      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await signInWithRedirect(firebaseAuth, provider);
        return;
      }
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    const current = firebaseAuth.currentUser;
    if (!current) throw new Error("No hay una sesión activa.");

    const displayName = sanitizePreferredName(name);
    if (displayName.length < 2) {
      throw new Error("Escribe un nombre de al menos 2 caracteres.");
    }

    await updateProfile(current, { displayName });
    await current.reload();
    setUser(firebaseAuth.currentUser);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signOut, updateDisplayName }),
    [loading, signInWithGoogle, signOut, updateDisplayName, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useLumaAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useLumaAuth must be used inside AuthProvider");
  return value;
}
