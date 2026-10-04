import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import styles from "./system-states.module.css";

export default function NotFound() {
  return (
    <main className={styles.statePage}>
      <div className="page-noise" />
      <span className={styles.stateIcon}><Compass size={30} /></span>
      <span className="eyebrow"><span className="eyebrow-dot" /> Ruta no encontrada</span>
      <h1>Esta no es parte de tu journey.</h1>
      <p>La página pudo cambiar o el enlace ya no existe. Tu Learning Twin y tu evidencia siguen intactos.</p>
      <Link className="button-primary" href="/learn"><ArrowLeft size={16} /> Volver a mi experiencia</Link>
    </main>
  );
}
