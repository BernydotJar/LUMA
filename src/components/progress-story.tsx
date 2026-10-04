"use client";

import { useState } from "react";
import { ArrowRight, Check, Compass, Sparkles } from "lucide-react";
import { SemanticObject } from "@/components/semantic-object";
import styles from "./progress-story.module.css";

const progressMoments = [
  {
    id: "demonstrated",
    eyebrow: "Capacidad demostrada",
    title: "Distingues el hecho de la interpretación.",
    body: "En una situación nueva separaste lo que ocurrió de la historia automática que apareció después.",
    evidence: "Simulación guiada · señal observada",
    icon: Check,
    object: "lens" as const,
  },
  {
    id: "transfer",
    eyebrow: "Transferencia reciente",
    title: "Convertiste un P.A.S. en una respuesta comprobable.",
    body: "La segunda formulación conservó la evidencia, redujo los absolutos y abrió una acción concreta.",
    evidence: "Práctica P.A.S. · 3/3 criterios",
    icon: Sparkles,
    object: "prism" as const,
  },
  {
    id: "next",
    eyebrow: "Siguiente demostración",
    title: "Aplicarás la misma habilidad con mayor autonomía.",
    body: "El próximo caso cambia el contexto y reduce las pistas para comprobar que la capacidad viaja contigo.",
    evidence: "Journey · práctica diferida",
    icon: Compass,
    object: "bridge" as const,
  },
];

export function ProgressStory() {
  const [active, setActive] = useState(1);

  return (
    <section className={styles.section} aria-labelledby="progress-story-title">
      <div className={styles.heading}>
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Tu progreso</span>
          <h2 id="progress-story-title">Tu progreso se expresa en capacidades demostradas.</h2>
          <p>Una lectura adulta de avance: qué ya puedes hacer, dónde lo aplicaste y cuál es la siguiente situación relevante.</p>
        </div>
        <span className={styles.signal}>Actualizado con tu última práctica</span>
      </div>

      <div className={styles.deck} role="tablist" aria-label="Momentos de progreso">
        {progressMoments.map((moment, index) => {
          const Icon = moment.icon;
          const selected = index === active;
          return (
            <button
              aria-controls={`progress-panel-${moment.id}`}
              aria-selected={selected}
              className={styles.card}
              data-active={selected}
              data-position={index - active}
              id={`progress-tab-${moment.id}`}
              key={moment.id}
              onClick={() => setActive(index)}
              role="tab"
              type="button"
            >
              <span className={styles.cardTop}>
                <span><Icon size={15} /> {moment.eyebrow}</span>
                <small>0{index + 1}</small>
              </span>
              <SemanticObject variant={moment.object} size="sm" className={styles.object} />
              <strong>{moment.title}</strong>
              <p>{moment.body}</p>
              <span className={styles.evidence}>{moment.evidence}</span>
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`progress-tab-${progressMoments[active].id}`}
        className={styles.detail}
        id={`progress-panel-${progressMoments[active].id}`}
        role="tabpanel"
      >
        <div>
          <small>Lectura para ti</small>
          <strong>{progressMoments[active].title}</strong>
        </div>
        <a href="/learn/session/pas">Continuar desde aquí <ArrowRight size={15} /></a>
      </div>
    </section>
  );
}
