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
  "Actividad de aprendizaje",
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
      subtitle="Consulta qué se aprende, cómo se practica y qué evidencia permite orientar el seguimiento."
    >
      <Link className={styles.back} href="/studio">
        <ArrowLeft size={15} /> Volver al estudio
      </Link>

      <section className={styles.hero}>
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Diseño de aprendizaje</span>
          <h2>Cada experiencia tiene un objetivo concreto.</h2>
          <p>
            Revisa la capacidad que trabaja cada experiencia, la práctica que propone y cómo identificar si una persona necesita refuerzo.
          </p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">
          <GitBranch size={46} />
        </div>
      </section>

      <section className={styles.metrics} aria-label="Cobertura de inteligencia de clases">
        <article><span>Experiencias definidas</span><strong>{classContracts.length}</strong><p>con objetivos de aprendizaje</p></article>
        <article><span>Diagnósticos</span><strong>{classContracts.length}</strong><p>ayudan a elegir por dónde comenzar</p></article>
        <article><span>Prácticas evaluables</span><strong>{scored}</strong><p>con criterios de evaluación</p></article>
        <article><span>Cambios de contenido</span><strong>Con revisión</strong><p>antes de incorporarlos al programa</p></article>
      </section>

      <section className={`${styles.pipelineCard} glass`}>
        <div className={styles.heading}>
          <div>
            <span className="eyebrow"><GitBranch size={14} /> Recorrido de aprendizaje</span>
            <h3>De la comprensión a la aplicación</h3>
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
            <span className="eyebrow"><BookOpenCheck size={14} /> Experiencias del programa</span>
            <h3>Qué practica y cómo avanza cada persona</h3>
          </div>
          <span>{classContracts.length} experiencias</span>
        </div>
        <ol className={styles.classList}>
          {classContracts.map((contract) => (
            <li key={contract.experienceSlug}>
              <div className={styles.classTopline}>
                <span><Target size={14} /> Objetivo de aprendizaje</span>
                <span data-authority={contract.evidenceContract.twinAuthority}>
                  {contract.evidenceContract.category === "scored" ? "Puntuada" : "De apoyo"}
                </span>
              </div>
              <h4>{contract.objective}</h4>
              <p>{topologyLabels[contract.topology]}</p>
              <dl>
                <div><dt>Evidencia</dt><dd>{contract.evidenceContract.label}</dd></div>
                <div><dt>Registro de progreso</dt><dd>{contract.evidenceContract.twinAuthority === "eligible" ? "Se confirma con evidencia" : "Orienta la práctica; requiere más evidencia"}</dd></div>
                <div><dt>Próxima comprobación</dt><dd>Tras {contract.deferredRecheck.delayHours} h</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${styles.refreshCard} glass`}>
        <div className={styles.refreshIcon}><RefreshCw size={22} /></div>
        <div>
          <span className="eyebrow">Actualización de contenidos</span>
          <h3>Los cambios se revisan antes de actualizar la experiencia.</h3>
          <p>
            Consulta qué conceptos o actividades necesitan una actualización, revisa las fuentes y aprueba los cambios pertinentes antes de publicarlos.
          </p>
          <div className={styles.guardrails}>
            <span><Check size={13} /> procedencia preservada</span>
            <span><Check size={13} /> impacto inspeccionable</span>
            <span><Check size={13} /> revisión del entrenador</span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
