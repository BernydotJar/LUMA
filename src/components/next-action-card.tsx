"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  ExternalLink,
  Play,
  Sparkles,
  Timer,
} from "lucide-react";
import type { RankedLearningAction } from "@/types/learning";
import styles from "./learner-components.module.css";

export function NextActionCard({ action }: { action: RankedLearningAction }) {
  const [showReason, setShowReason] = useState(false);

  return (
    <section className={`${styles.nextAction} glass`} aria-labelledby="next-action-title">
      <div className={styles.nextActionGlow} aria-hidden="true" />
      <div className={styles.nextActionTop}>
        <span className="eyebrow"><span className="eyebrow-dot" /> Tu siguiente movimiento</span>
        <div className={styles.nextActionMeta}>
          <span><Timer size={14} /> {action.minutes} min</span>
          <span><Sparkles size={14} /> Adaptado hoy</span>
        </div>
      </div>

      <div className={styles.nextActionContent}>
        <span className={styles.actionIcon} aria-hidden="true">
          <span className={styles.actionIconCore}><Play size={25} fill="currentColor" /></span>
        </span>
        <div>
          <p className={styles.kicker}>Práctica guiada · aplicación real</p>
          <h2 id="next-action-title">{action.title}</h2>
          <p className={styles.actionDescription}>{action.description}</p>
        </div>
      </div>

      <div className={styles.actionReasonStrip}>
        <span><Check size={15} /> Ya dominas el prerrequisito</span>
        <span><Check size={15} /> La teoría no es el problema</span>
        <span><Check size={15} /> Cabe en tus {action.minutes} minutos</span>
      </div>

      <div className={styles.nextActionFooter}>
        <Link className="button-primary" href="/learn/session/pas">
          Continuar · {action.minutes} min <ArrowRight size={17} />
        </Link>
        <button
          className={styles.whyButton}
          type="button"
          onClick={() => setShowReason((current) => !current)}
          aria-expanded={showReason}
        >
          ¿Por qué cambió mi ruta?
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
            <div><dt>Hecho</dt><dd>Fallaste dos veces al transferir el concepto a una situación concreta.</dd></div>
            <div><dt>Inferencia</dt><dd>Reconoces el concepto, pero todavía no aparece con fluidez bajo presión.</dd></div>
            <div><dt>Siguiente señal</dt><dd>Resolver este caso sin ayuda movería el journey hacia creencias.</dd></div>
          </dl>
          <div className={styles.explanationFooter}>
            <p className={styles.inferenceNote}>La inferencia tiene 68% de confianza; no es un diagnóstico.</p>
            <a href={action.sourceUrl} target="_blank" rel="noreferrer">
              <BookOpenCheck size={14} /> Ver evidencia fuente <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
