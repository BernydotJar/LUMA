"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronDown,
  ExternalLink,
  Lightbulb,
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
      <div className={styles.nextActionGlow} />
      <div className={styles.nextActionTop}>
        <span className="eyebrow"><span className="eyebrow-dot" /> Tu mejor siguiente acción</span>
        <div className={styles.nextActionMeta}>
          <span><Timer size={14} /> {action.minutes} min</span>
          <span><Sparkles size={14} /> {Math.round(action.confidence * 100)}% confianza</span>
        </div>
      </div>
      <div className={styles.nextActionContent}>
        <span className={styles.actionIcon}><Lightbulb size={28} /></span>
        <div>
          <p className={styles.kicker}>Práctica guiada · Pensamientos automáticos</p>
          <h2 id="next-action-title">{action.title}</h2>
          <p className={styles.actionDescription}>{action.description}</p>
        </div>
      </div>
      <div className={styles.actionReasonStrip}>
        <span><Check size={15} /> 2 intentos recientes</span>
        <span><Check size={15} /> Se ajusta a tus 12 minutos</span>
        <span><Check size={15} /> Prerrequisito dominado</span>
      </div>
      <div className={styles.nextActionFooter}>
        <Link className="button-primary" href="/learn/session/pas">
          <Play size={17} fill="currentColor" /> Comenzar ahora <ArrowRight size={17} />
        </Link>
        <button className="button-secondary" type="button" onClick={() => setShowReason((current) => !current)} aria-expanded={showReason}>
          ¿Por qué esto? <ChevronDown size={16} style={{ transform: showReason ? "rotate(180deg)" : undefined }} />
        </button>
        <a className="button-ghost" href={action.sourceUrl} target="_blank" rel="noreferrer">
          <BookOpenCheck size={16} /> Ver fuente <ExternalLink size={13} />
        </a>
      </div>
      {showReason && (
        <div className={styles.explanationPanel}>
          <div>
            <strong>La decisión de LUMA</strong>
            <p>{action.reason}</p>
          </div>
          <dl>
            <div><dt>Señal observada</dt><dd>Fallaste dos veces al transferir el concepto a una situación concreta.</dd></div>
            <div><dt>Hipótesis</dt><dd>El concepto está reconocido, pero todavía no se recupera con fluidez bajo presión.</dd></div>
            <div><dt>Qué cambiaría la ruta</dt><dd>Una respuesta correcta sin ayuda movería el Twin hacia práctica de creencias.</dd></div>
          </dl>
          <p className={styles.inferenceNote}>La hipótesis es una inferencia con 68% de confianza, no un diagnóstico.</p>
        </div>
      )}
    </section>
  );
}
