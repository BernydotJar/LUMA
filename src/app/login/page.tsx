"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { GoogleMark } from "@/components/google-mark";
import { useLumaAuth } from "@/components/auth-provider";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle } = useLumaAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/learn");
  }, [loading, router, user]);

  async function login() {
    setBusy(true);
    setNotice("");
    try {
      await signInWithGoogle();
      router.replace("/learn");
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setNotice("No pudimos completar el acceso con Google. Inténtalo de nuevo.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <BrandMark />
        <Link href="/learn">Explorar LUMA <ArrowRight size={15} /></Link>
      </header>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}><Sparkles size={14} /> Tu experiencia LUMA</span>
          <h1>Tu aprendizaje, con continuidad.</h1>
          <p>
            Accede con Google para que LUMA pueda reconocerte en esta experiencia.
            Usaremos tu nombre de Google al inicio y podrás elegir cómo quieres que te llamemos.
          </p>

          <button className={styles.googleButton} type="button" disabled={busy || loading} onClick={() => void login()}>
            <GoogleMark size={20} />
            <span>{busy ? "Conectando…" : "Continuar con Google"}</span>
          </button>

          {notice && <p className={styles.notice} role="status">{notice}</p>}

          <div className={styles.trust}>
            <ShieldCheck size={16} />
            <span>Tu sesión usa Firebase Authentication. LUMA no recibe tu contraseña de Google.</span>
          </div>

          <Link className={styles.demoLink} href="/learn">
            Explorar las experiencias de aprendizaje
          </Link>
        </div>

        <aside className={styles.card} aria-label="Qué cambia al acceder">
          <span>Al acceder</span>
          <strong>Tu nombre aparece en LUMA y puedes cambiarlo cuando quieras.</strong>
          <ol>
            <li><b>01</b><span>Google confirma tu identidad.</span></li>
            <li><b>02</b><span>LUMA toma tu nombre visible como punto de partida.</span></li>
            <li><b>03</b><span>Desde tu perfil eliges el nombre que prefieras.</span></li>
          </ol>
        </aside>
      </section>
    </main>
  );
}
