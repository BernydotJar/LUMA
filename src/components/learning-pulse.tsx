import { ArrowUpRight, CircleCheck, Layers3 } from "lucide-react";
import { SemanticObject } from "@/components/semantic-object";
import type { TwinDimension } from "@/types/learning";
import styles from "./learning-pulse.module.css";

const dimensionLabel: Record<string, string> = {
  knowledge: "Comprensión",
  application: "Aplicación",
  confidence: "Confianza personal",
};

const bandLabel: Record<TwinDimension["band"], string> = {
  strong: "Base sólida",
  developing: "En desarrollo",
  "needs-attention": "Necesita práctica",
};

export function LearningPulse({
  dimensions,
  personalized,
  hasVerifiedEvidence,
}: {
  dimensions: TwinDimension[];
  personalized: boolean;
  hasVerifiedEvidence: boolean;
}) {
  const focus = dimensions.filter((item) =>
    ["knowledge", "application", "confidence"].includes(item.id),
  );
  return (
    <aside className={styles.panel} aria-labelledby="learning-pulse-title">
      <header className={styles.header}>
        <span className={styles.eyebrow}><Layers3 size={15} aria-hidden="true" /> TU MAPA DE HABILIDADES</span>
        <span className={styles.orbit} aria-hidden="true"><SemanticObject variant="orbit" size="sm" /></span>
      </header>
      <h2 id="learning-pulse-title">Una mirada a tu recorrido.</h2>
      <p className={styles.description}>
        {personalized
          ? "Tu perfil orienta la práctica. El dominio solo se confirma con criterios evaluados."
          : "Al empezar, podrás registrar tus experiencias y comprobar qué vas desarrollando."}
      </p>
      <dl className={styles.metrics} aria-label="Señales de aprendizaje">
        {focus.map((item) => {
          const status = !personalized ? "Por explorar"
            : item.id === "confidence" ? "Autopercepción"
              : item.id === "application" && hasVerifiedEvidence
                ? bandLabel[item.band] : "Por comprobar";
          return (
            <div className={styles.metric} key={item.id}>
              <dt><CircleCheck size={15} aria-hidden="true" /> {dimensionLabel[item.id]}</dt>
              <dd>{status}</dd>
            </div>
          );
        })}
      </dl>
      <div className={styles.note}>
        <ArrowUpRight size={15} aria-hidden="true" />
        <span>{hasVerifiedEvidence ? "Consulta el registro de tu práctica para revisar los criterios." : "Tu siguiente práctica puede aportar la primera evidencia."}</span>
      </div>
    </aside>
  );
}
