"use client";

import Link from "next/link";
import { RotateCcw, ShieldAlert } from "lucide-react";
import styles from "./system-states.module.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.statePage}>
      <div className="page-noise" />
      <span className={styles.stateIcon}><ShieldAlert size={30} /></span>
      <span className="eyebrow"><span className="eyebrow-dot" /> Estado recuperable</span>
      <h1>Tu progreso está seguro.</h1>
      <p>Esta vista tuvo un problema al cargar. Tu sesión conserva el último estado válido.</p>
      <div className={styles.stateActions}>
        <button className="button-primary" type="button" onClick={reset}><RotateCcw size={16} /> Reintentar</button>
        <Link className="button-secondary" href="/learn">Volver a Hoy</Link>
      </div>
    </main>
  );
}
