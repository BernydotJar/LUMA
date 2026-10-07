import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  GitBranch,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { classContracts } from "@/lib/class-contract";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Inteligencia de clases · LUMA" };

const pipeline = [
  "Fuente autorizada",
  "Objetivo observable",
  "Topología de clase",
  "Práctica",
  "Evidencia",
  "Remediación",
  "Transferencia",
  "Recomprobación",
];

const topologyLabels = {
  "concept-contrast-case-transfer": "Concepto → contraste → caso → transferencia",
  "scenario-decision-feedback-replay": "Escenario → decisión → feedback → replay",
  "demonstrate-diagnose-remediate-recheck": "Demostrar → diagnosticar → remediar → recomprobar",
  "observe-label-interpret-test": "Observar → nombrar → interpretar → comprobar",
} as const;

export default function ClassIntelligencePage() {
  const scored = classContracts.filter(
    (contract) => contract.evidenceContract.category === "scored",
  ).length;

  return (
    <AppShell
      mode="studio"
      title="Inteligencia de clases"
      subtitle="Cómo LUMA convierte conocimiento experto en práctica, evidencia y mejora continua sin perder trazabilidad."
    >
      <Link className={styles.back} href="/studio">
        <ArrowLeft size={15} /> Volver al estudio
      </Link>

      <section className={styles.hero}>
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Pedagogía como sistema</span>
          <h2>La clase también aprende.</h2>
          <p>
            Cada experiencia declara qué capacidad busca desarrollar, qué evidencia acepta y qué debe ocurrir si la persona necesita refuerzo. Las nuevas fuentes generan propuestas de cambio; no modifican una clase publicada de forma silenciosa.
          </p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">
          <GitBranch size={46} />
        </div>
      </section>

      <section className={styles.metrics} aria-label="Cobertura de inteligencia de clases">
        <article><span>Contratos activos</span><strong>{classContracts.length}</strong><p>uno por experiencia publicada</p></article>
        <article><span>Diagnósticos</span><strong>{classContracts.length}</strong><p>rutean el punto de entrada</p></article>
        <article><span>Evidencia puntuada</span><strong>{scored}</strong><p>la simulación P.A.S. es la referencia</p></article>
        <article><span>Actualización silenciosa</span><strong>0</strong><p>todo refresh requiere promoción</p></article>
      </section>

      <section className={`${styles.pipelineCard} glass`}>
        <div className={styles.heading}>
          <div>
            <span className="eyebrow"><GitBranch size={14} /> Protocolo de clase</span>
            <h3>De fuente a transferencia</h3>
          </div>
          <span className="status-pill" data-tone="positive"><ShieldCheck size={13} /> gobernado</span>
        </div>
        <div className={styles.pipeline}>
          {pipeline.map((step, index) => (
            <div key={step}>
              <i>{String(index + 1).padStart(2, "0")}</i>
              <strong>{step}</strong>
              {index < pipeline.length - 1 && <ArrowRight size={14} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      <section className={styles.classSection}>
        <div className={styles.heading}>
          <div>
            <span className="eyebrow"><BookOpenCheck size={14} /> Contratos publicados</span>
            <h3>Qué exige cada experiencia</h3>
          </div>
          <span>{classContracts.length} experiencias</span>
        </div>
        <ol className={styles.classList}>
          {classContracts.map((contract) => (
            <li key={contract.experienceSlug}>
              <div className={styles.classTopline}>
                <span><Target size={14} /> {contract.capabilityId}</span>
                <span data-authority={contract.evidenceContract.twinAuthority}>
                  {contract.evidenceContract.category === "scored" ? "Puntuada" : "De apoyo"}
                </span>
              </div>
              <h4>{contract.objective}</h4>
              <p>{topologyLabels[contract.topology]}</p>
              <dl>
                <div><dt>Evidencia</dt><dd>{contract.evidenceContract.label}</dd></div>
                <div><dt>Autoridad</dt><dd>{contract.evidenceContract.twinAuthority === "eligible" ? "Puede actualizar progreso tras verificación" : "Apoya contexto; no certifica dominio"}</dd></div>
                <div><dt>Recheck</dt><dd>{contract.deferredRecheck.delayHours} h</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${styles.refreshCard} glass`}>
        <div className={styles.refreshIcon}><RefreshCw size={22} /></div>
        <div>
          <span className="eyebrow">Reflexión de conocimiento</span>
          <h3>Una fuente nueva crea una propuesta, no una mutación.</h3>
          <p>
            LUMA identifica las clases afectadas, propone cambios sobre ideas, práctica, rúbrica y remediación, ejecuta regresiones y espera una promoción humana antes de publicar.
          </p>
          <div className={styles.guardrails}>
            <span><Check size={13} /> procedencia preservada</span>
            <span><Check size={13} /> impacto inspeccionable</span>
            <span><Check size={13} /> promoción humana</span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
