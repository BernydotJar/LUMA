import styles from "./system-states.module.css";

export default function Loading() {
  return (
    <main className={styles.statePage} aria-label="Cargando LUMA">
      <div className="page-noise" />
      <div className={styles.loadingMark}><span>L</span></div>
      <p>LUMA está reuniendo tu contexto…</p>
      <div className={styles.loadingBar}><span /></div>
    </main>
  );
}
