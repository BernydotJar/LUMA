import { Check, Sparkles, TrendingUp } from "lucide-react";
import type { TwinDimension } from "@/types/learning";
import styles from "./learning-pulse.module.css";

const signalLabel: Record<string, { label: string; state: string }> = {
  knowledge: { label: "Comprensión", state: "Sólida" },
  application: { label: "Aplicación", state: "En desarrollo" },
  confidence: { label: "Confianza", state: "Creciendo" },
};

export function LearningPulse({ dimensions }: { dimensions: TwinDimension[] }) {
  const focus = dimensions.filter((item) =>
    ["knowledge", "application", "confidence"].includes(item.id),
  );

  return (
    <aside className={styles.panel} aria-labelledby="learning-pulse-title">
      <div className={styles.panelGlow} aria-hidden="true" />
      <header>
        <span className={styles.kicker}><Sparkles size={14} /> Tu progreso</span>
        <span className={styles.progressMark} aria-hidden="true">
          <Check size={16} />
        </span>
      </header>

      <div className={styles.stage} aria-hidden="true">
        <div className={styles.sun}>
          <span className={styles.sunCore}><Sparkles size={30} /></span>
          <span className={styles.orbitOne} />
          <span className={styles.orbitTwo} />
          <span className={styles.orbitThree} />
        </div>
        {focus.map((item, index) => {
          const signal = signalLabel[item.id];
          return (
            <span
              className={styles.floatingMetric}
              data-index={index}
              key={item.id}
            >
              <small>{signal.label}</small>
              <strong>{signal.state}</strong>
            </span>
          );
        })}
      </div>

      <div className={styles.readout}>
        <span className={styles.signal}><TrendingUp size={14} /> Progreso esta semana</span>
        <h2 id="learning-pulse-title">La aplicación es tu foco de hoy.</h2>
        <p>
          La práctica convierte reconocimiento en una respuesta que puedes usar
          en situaciones reales.
        </p>
      </div>
    </aside>
  );
}
