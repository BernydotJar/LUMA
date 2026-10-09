"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Timer,
} from "lucide-react";
import { SemanticObject } from "@/components/semantic-object";
import type { RankedLearningAction } from "@/types/learning";
import styles from "./learner-components.module.css";

export function NextActionCard({ action }: { action: RankedLearningAction }) {
  const [showReason, setShowReason] = useState(false);
  const actionHref = action.href ?? "/learn/experiences";
  const actionKindLabel =
    action.kind === "continue"
      ? "Siguiente reto"
      : action.kind === "review"
        ? "Refuerzo recomendado"
        : action.kind === "diagnostic"
          ? "Comprobación breve"
          : action.kind === "simulation"
            ? "Simulación"
            : "Práctica guiada";

  return (
    <section className={`${styles.nextAction} content-surface`} aria-labelledby="next-action-title">
      <div className={styles.nextActionGlow} aria-hidden="true" />
      <div className={styles.nextActionTop}>
        <span className="eyebrow"><span className="eyebrow-dot" /> Tu siguiente movimiento</span>
        <div className={styles.nextActionMeta}>
          <span><Timer size={14} /> {action.minutes} min</span>
          <span><Sparkles size={14} /> Adaptado hoy</span>
        </div>
      </div>

      <div className={styles.nextActionContent}>
        <span className={styles.actionObject} aria-hidden="true">
          <SemanticObject variant="prism" size="md" />
        </span>
        <div>
          <p className={styles.kicker}>{actionKindLabel} · aplicación real</p>
          <h2 id="next-action-title">{action.title}</h2>
          <p className={styles.actionDescription}>{action.description}</p>
        </div>
      </div>

      <div className={styles.actionReasonStrip}>
        <span><Check size={15} /> Alineado con tu objetivo</span>
        <span><Check size={15} /> {Math.round(action.confidence * 100)}% de confianza de recomendación</span>
        <span><Check size={15} /> Cabe en tus {action.minutes} minutos</span>
      </div>

      <div className={styles.nextActionFooter}>
        <Link className="button-primary" href={actionHref}>
          Continuar · {action.minutes} min <ArrowRight size={17} />
        </Link>
        <button
          className={styles.whyButton}
          type="button"
          onClick={() => setShowReason((current) => !current)}
          aria-expanded={showReason}
        >
          ¿Por qué esta práctica?
          <ChevronDown
            size={16}
            style={{ transform: showReason ? "rotate(180deg)" : undefined }}
          />
        </button>
      </div>

      {showReason && (
        <div className={styles.explanationPanel}>
          <div className={styles.explanationLead}>
            <strong>Lo que LUMA observó</strong>
            <p>{action.reason}</p>
          </div>
          <dl>
            <div><dt>Señal</dt><dd>{action.reason}</dd></div>
            <div><dt>Lectura</dt><dd>LUMA priorizó esta acción frente a las alternativas que compiten por tu tiempo disponible.</dd></div>
            <div><dt>Siguiente señal</dt><dd>Tu resultado volverá a ordenar la ruta; completar contenido por sí solo no equivale a dominio.</dd></div>
          </dl>
          <div className={styles.explanationFooter}>
            <p className={styles.inferenceNote}>Hipótesis de aprendizaje: {Math.round(action.confidence * 100)}% de confianza. Se actualiza con cada nueva señal.</p>
            <a href={action.sourceUrl} target="_blank" rel="noreferrer">
              <BookOpenCheck size={14} /> Ver fuente <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
