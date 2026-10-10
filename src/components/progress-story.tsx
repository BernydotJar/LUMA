"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, ClipboardCheck, Compass } from "lucide-react";
import { SemanticObject } from "@/components/semantic-object";
import type { StoredLearningEvent } from "@/lib/learner-projection";
import { evidenceMayUpdateTwin } from "@/lib/simulation-evidence";
import type { RankedLearningAction } from "@/types/learning";
import styles from "./progress-story.module.css";

interface ProgressStoryProps {
  event?: StoredLearningEvent;
  nextAction: RankedLearningAction;
}

export function ProgressStory({ event, nextAction }: ProgressStoryProps) {
  const [active, setActive] = useState(1);
  const receipt = event && evidenceMayUpdateTwin(event) ? event : undefined;
  const criteria = receipt?.criteria ?? [];
  const passed = criteria.filter((criterion) => criterion.passed).length;
  const nextHref = nextAction.href ?? "/learn/experiences";

  // Never display demo learner achievements as if they belonged to the visitor.
  if (!receipt) {
    return (
      <section className={styles.section} aria-labelledby="progress-story-title">
        <div className={styles.heading}>
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" /> Tu progreso</span>
            <h2 id="progress-story-title">Tu avance cobra forma con cada práctica.</h2>
            <p>Las experiencias evaluadas aportan señales concretas sobre lo que puedes aplicar y lo que conviene seguir trabajando.</p>
          </div>
          <span className={styles.signal}>Evidencia cuando esté disponible</span>
        </div>
        <div className={styles.emptyState}>
          <SemanticObject variant="lens" size="md" className={styles.emptyObject} />
          <div>
            <span className="eyebrow">Tu siguiente evidencia</span>
            <h3>Empieza por una situación real.</h3>
            <p>Completa una práctica para consultar su resultado y sus criterios. Tu ruta seguirá construyéndose con lo que demuestres.</p>
          </div>
          <Link className={styles.emptyAction} href={nextHref}>Iniciar práctica <ArrowRight size={17} /></Link>
        </div>
      </section>
    );
  }

  const resultTitle = criteria.length
    ? "Cumpliste " + passed + " de " + criteria.length + " criterios."
    : typeof receipt.correctCount === "number"
      ? "Registraste " + receipt.correctCount + " respuestas correctas."
      : "Tu práctica quedó registrada.";

  const progressMoments = [
    {
      id: "recorded",
      eyebrow: "Práctica registrada",
      title: "Una situación de aprendizaje ya tiene resultado.",
      body: "Puedes consultar lo que respondió la actividad. Una práctica registrada no equivale automáticamente a dominio.",
      evidence: "Resultado de la actividad · registro local",
      icon: ClipboardCheck,
      object: "lens" as const,
    },
    {
      id: "criteria",
      eyebrow: "Criterios de evaluación",
      title: resultTitle,
      body: "La rúbrica permite distinguir los criterios alcanzados de los que todavía requieren práctica.",
      evidence: receipt.rubricId ? "Rúbrica " + receipt.rubricId : "Lectura de la práctica",
      icon: Check,
      object: "prism" as const,
    },
    {
      id: "next",
      eyebrow: "Siguiente demostración",
      title: nextAction.title,
      body: "Continúa en otro contexto para comprobar tu capacidad de aplicar lo aprendido.",
      evidence: "Siguiente acción · " + nextAction.minutes + " min",
      icon: Compass,
      object: "bridge" as const,
    },
  ];
  const selected = progressMoments[active];

  return (
    <section className={styles.section} aria-labelledby="progress-story-title">
      <div className={styles.heading}>
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Tu progreso</span>
          <h2 id="progress-story-title">Tu avance se apoya en evidencias concretas.</h2>
          <p>Revisa el resultado de tu práctica, sus criterios y la siguiente oportunidad de aplicación.</p>
        </div>
        <span className={styles.signal}>Práctica registrada en este dispositivo</span>
      </div>
      <div className={styles.deck} role="tablist" aria-label="Momentos de progreso">
        {progressMoments.map((moment, index) => {
          const Icon = moment.icon;
          const isSelected = index === active;
          return (
            <button
              aria-controls="progress-story-panel"
              aria-selected={isSelected}
              className={styles.card}
              data-active={isSelected}
              data-position={index - active}
              id={"progress-tab-" + moment.id}
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
        aria-labelledby={"progress-tab-" + selected.id}
        className={styles.detail}
        id="progress-story-panel"
        role="tabpanel"
      >
        <div>
          <small>Lectura para ti</small>
          <strong>{selected.title}</strong>
        </div>
        <Link href={nextHref}>Continuar desde aquí <ArrowRight size={15} /></Link>
      </div>
    </section>
  );
}
