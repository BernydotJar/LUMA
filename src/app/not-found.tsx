import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import styles from "./system-states.module.css";

export default function NotFound() {
  return (
    <main className={styles.statePage}>
      <div className="page-noise" />
      <span className={styles.stateIcon}><Compass size={30} /></span>
      <span className="eyebrow"><span className="eyebrow-dot" /> Continuar journey</span>
      <h1>Tu journey continúa desde aquí.</h1>
      <p>El enlace puede haber cambiado. Vuelve a tu sesión o al siguiente paso de aprendizaje.</p>
      <Link className="button-primary" href="/learn"><ArrowLeft size={16} /> Volver a mi experiencia</Link>
    </main>
  );
}
