import { Check, Flag, LockKeyhole, Sparkles } from "lucide-react";
import type { JourneyStep } from "@/types/learning";
import styles from "./learner-components.module.css";

export function LearningJourney({ steps }: { steps: JourneyStep[] }) {
  return (
    <section className={`${styles.journeyCard} content-surface`} id="journey" aria-labelledby="journey-title">
      <div className={styles.cardHeading}>
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Tu ruta</span>
          <h2 id="journey-title">Tu ruta avanza con lo que demuestras.</h2>
        </div>
        <span className="status-pill" data-tone="positive">Se adapta</span>
      </div>
      <div className={styles.journeyRail}>
        {steps.map((step, index) => (
          <article className={styles.journeyStep} data-status={step.status} key={step.id}>
            <div className={styles.stepMarker}>
              {step.status === "complete" && <Check size={16} />}
              {step.status === "current" && <Sparkles size={16} />}
              {step.status === "upcoming" && (index === steps.length - 1 ? <Flag size={15} /> : <LockKeyhole size={14} />)}
            </div>
            <div>
              <span>{step.status === "complete" ? "Demostrado" : step.status === "current" ? "Ahora" : "Después"}</span>
              <h3>{step.label}</h3>
              <p>{step.detail}</p>
            </div>
          </article>
        ))}
      </div>
      <p className={styles.journeyNote}>Cada nueva señal puede adelantar tu ruta o activar una práctica específica para fortalecer el siguiente paso.</p>
    </section>
  );
}
