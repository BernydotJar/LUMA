"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronDown,
  Clock3,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import type { RankedLearningAction } from "@/types/learning";
import styles from "./learner-components.module.css";

export function NextActionCard({
  action,
  personalized = true,
  variant = "standard",
}: {
  action: RankedLearningAction;
  personalized?: boolean;
  variant?: "hero" | "standard";
}) {
  const [showReason, setShowReason] = useState(false);
  const actionHref = action.href ?? "/learn/experiences";
  const reasonCopy = personalized
    ? action.reason
    : "Una práctica del programa para explorar tu punto de partida. Todavía no se han evaluado tus capacidades.";
  const actionKindLabel =
    action.kind === "review" ? "Refuerzo"
      : action.kind === "diagnostic" ? "Diagnóstico"
        : action.kind === "simulation" ? "Simulación"
          : action.kind === "continue" ? "Siguiente paso" : "Práctica guiada";

  return (
    <section
      className={styles.nextAction + " content-surface"}
      data-variant={variant}
      aria-labelledby="next-action-title"
    >
      <div className={styles.nextActionTop}>
        <span className={styles.practiceEyebrow}>
          <Sparkles size={15} aria-hidden="true" />
          PARA CONTINUAR
        </span>
        <span className={styles.practiceDuration}><Clock3 size={15} aria-hidden="true" /> {action.minutes} min</span>
      </div>

      <div className={styles.nextActionContent}>
        <div>
          <p className={styles.kicker}>{actionKindLabel}</p>
          <h2 id="next-action-title">{action.title}</h2>
          <p className={styles.actionDescription}>{action.description}</p>
        </div>
      </div>

      <div className={styles.nextActionFooter}>
        <Link className="button-primary" href={actionHref}>
          {personalized ? "Continuar" : "Empezar práctica"} · {action.minutes} min
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <button
          className={styles.whyButton}
          type="button"
          aria-controls="practice-recommendation-explanation"
          aria-expanded={showReason}
          onClick={() => setShowReason((current) => !current)}
        >
          ¿Por qué esta práctica? <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {showReason && (
        <div className={styles.explanationPanel} id="practice-recommendation-explanation">
          <strong>El motivo de esta sugerencia</strong>
          <p>{reasonCopy}</p>
          <p className={styles.inferenceNote}>
            Es una orientación, no una certificación de dominio. Las prácticas evaluadas ayudan a revisarla.
          </p>
          {action.sourceUrl && (
            <a href={action.sourceUrl} target="_blank" rel="noopener noreferrer">
              <BookOpenCheck size={15} aria-hidden="true" /> Ver material de referencia
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </section>
  );
}
