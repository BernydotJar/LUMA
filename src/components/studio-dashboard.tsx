"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  CircleUserRound,
  Clock3,
  FileWarning,
  Filter,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { studioSignals } from "@/lib/luma-data";
import { SemanticObject } from "@/components/semantic-object";
import styles from "./studio-dashboard.module.css";

const bottlenecks = [
  { id: "pas", label: "P.A.S. en contexto", mastery: 49, affected: 41, severity: "high", insight: "El siguiente salto es separar acontecimiento, pensamiento y emoción con fluidez en escenarios nuevos." },
  { id: "levels", label: "Niveles lógicos", mastery: 62, affected: 28, severity: "medium", insight: "El grupo reconoce los niveles; la oportunidad está en elegir el punto de intervención en casos ambiguos." },
  { id: "beliefs", label: "Cambio de creencias", mastery: 55, affected: 34, severity: "high", insight: "La práctica se concentra en formular alternativas comprobables y conectadas con evidencia." },
  { id: "values", label: "Jerarquía de valores", mastery: 71, affected: 18, severity: "low", insight: "El desempeño conceptual es sólido; la próxima señal será una comprobación diferida de retención." },
];

const learners = [
  { id: "mariana", initials: "MM", name: "Mariana", signal: "P.A.S.: transferencia en desarrollo", confidence: "68%", action: "Abrir gemelo de aprendizaje", urgency: "medium" },
  { id: "maria", initials: "MV", name: "María V.", signal: "P.A.S.: 3 intentos con apoyo", confidence: "Baja", action: "Sesión humana", urgency: "high" },
  { id: "carlos", initials: "CR", name: "Carlos R.", signal: "Evidencia mixta entre evaluación y conducta", confidence: "Media", action: "Revisión de evidencia", urgency: "medium" },
  { id: "ana", initials: "AL", name: "Ana L.", signal: "4 consultas sobre el mismo concepto", confidence: "Baja", action: "Tutor + check-in", urgency: "high" },
  { id: "jorge", initials: "JM", name: "Jorge M.", signal: "Última actividad: hace 8 días", confidence: "Alta", action: "Nudge contextual", urgency: "low" },
];

export function StudioDashboard() {
  const [selectedBottleneck, setSelectedBottleneck] = useState("pas");
  const [period, setPeriod] = useState("Últimos 7 días");
  const [assigned, setAssigned] = useState<string[]>([]);
  const selected = useMemo(() => bottlenecks.find((item) => item.id === selectedBottleneck) ?? bottlenecks[0], [selectedBottleneck]);

  const assign = (id: string) => setAssigned((current) => current.includes(id) ? current : [...current, id]);

  return (
    <div className={styles.dashboard}>
      <section className={styles.controlBar}>
        <div>
          <span className="status-pill" data-tone="positive"><span className={styles.liveDot} /> Corpus sincronizado</span>
          <span>Practitioner · Cohorte abril 2026</span>
        </div>
        <div>
          <button type="button"><Filter size={15} /> Módulo 3 <ChevronDown size={14} /></button>
          <button type="button" onClick={() => setPeriod((current) => current === "Últimos 7 días" ? "Últimos 30 días" : "Últimos 7 días")}><Clock3 size={15} /> {period} <ChevronDown size={14} /></button>
        </div>
      </section>

      <section className={styles.metricGrid}>
        <article className={`${styles.heroMetric} glass`}>
          <span className={styles.metricIcon}><TrendingUp size={22} /></span>
          <div><small>Progreso verificado</small><strong>+18.4%</strong><p>Competencia demostrada por hora efectiva</p></div>
          <span className={styles.metricDelta}>+3.2 vs. periodo anterior</span>
          <div className={styles.sparkline} aria-hidden="true"><i style={{ height: "25%" }} /><i style={{ height: "38%" }} /><i style={{ height: "31%" }} /><i style={{ height: "52%" }} /><i style={{ height: "62%" }} /><i style={{ height: "74%" }} /><i style={{ height: "88%" }} /></div>
        </article>
        {[
          [Users, "Participantes activos", "128", "82% de la cohorte"],
          [BrainCircuit, "Dominio mediano", "64%", "+6 puntos"],
          [AlertTriangle, "Intervención humana", "7", "4 prioridad alta"],
          [BookOpenCheck, "Calidad de aprendizaje", "86", "2 objetivos en revisión"],
        ].map(([Icon, label, value, detail]) => {
          const MetricIcon = Icon as typeof Users;
          return (
            <article className="glass-subtle" key={String(label)}>
              <span><MetricIcon size={19} /></span>
              <small>{String(label)}</small>
              <strong>{String(value)}</strong>
              <p>{String(detail)}</p>
            </article>
          );
        })}
      </section>

      <section className={styles.signalGrid}>
        {studioSignals.map((signal) => (
          <article className="glass-subtle" key={signal.id} data-trend={signal.trend}>
            <span>{signal.label}</span><strong>{signal.value}</strong><p>{signal.detail}</p>
          </article>
        ))}
      </section>

      <div className={styles.mainGrid}>
        <section className={`${styles.bottleneckCard} glass`}>
          <div className={styles.cardHeading}>
            <div><span className="eyebrow"><AlertTriangle size={14} /> Oportunidades de refuerzo</span><h2>Dónde una intervención mejora el aprendizaje</h2></div>
            <span className="status-pill" data-tone="warning">4 señales activas</span>
          </div>
          <div className={styles.bottleneckLayout}>
            <div className={styles.bottleneckChart}>
              {bottlenecks.map((item) => (
                <button type="button" key={item.id} data-selected={selectedBottleneck === item.id} onClick={() => setSelectedBottleneck(item.id)}>
                  <span>{item.label}</span>
                  <div><i style={{ width: `${item.mastery}%` }} /></div>
                  <strong>{item.mastery}%</strong>
                  <small>{item.affected}% con oportunidad</small>
                </button>
              ))}
            </div>
            <div className={styles.insightPanel} data-severity={selected.severity}>
              <SemanticObject variant="strata" size="sm" className={styles.insightObject} />
              <span><Sparkles size={17} /> Lectura de LUMA</span>
              <h3>{selected.label}</h3>
              <p>{selected.insight}</p>
              <dl>
                <div><dt>Señal</dt><dd>{selected.affected}% de participantes</dd></div>
                <div><dt>Dominio</dt><dd>{selected.mastery}% mediano</dd></div>
                <div><dt>Confianza</dt><dd>84% en la señal</dd></div>
              </dl>
              <button className="button-secondary" type="button">Ver evidencia y segmentos <ArrowRight size={15} /></button>
            </div>
          </div>
          <div className={styles.interventionEffect}>
            <div><span className={styles.effectIcon}><MessageSquareText size={19} /></span><div><strong>La pregunta socrática generó la mejora más alta</strong><p>63% mejoró en el segundo intento frente a 38% con explicación directa.</p></div></div>
            <span>n=46 interacciones</span>
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={`${styles.qualityCard} glass`}>
            <div className={styles.cardHeading}><div><span className="eyebrow"><FileWarning size={14} /> Calidad curricular</span><h2>86 / 100</h2></div><span className={styles.qualityRing}>86</span></div>
            <div className={styles.qualityList}>
              {[["Cobertura de objetivos", 92], ["Alineación evaluación", 78], ["Prerrequisitos", 84], ["Frescura de contenido", 88]].map(([label, value]) => (
                <div key={String(label)}><span>{String(label)}</span><div><i style={{ width: `${Number(value)}%` }} /></div><strong>{Number(value)}</strong></div>
              ))}
            </div>
            <p><ShieldCheck size={14} /> Cada componente explica el puntaje y conserva trazabilidad.</p>
          </section>

          <section className={`${styles.questionCard} glass`}>
            <span className="eyebrow"><MessageSquareText size={14} /> Pregunta repetida</span>
            <blockquote>“¿Cómo sé si una creencia es mía o aprendida?”</blockquote>
            <p>26 participantes · 41 preguntas similares · Módulo 3</p>
            <button className="button-secondary" type="button">Crear refuerzo de 3 min <Sparkles size={15} /></button>
          </section>
        </aside>
      </div>

      <section className={`${styles.interventionQueue} glass`}>
        <SemanticObject variant="bridge" size="sm" className={styles.interventionObject} />
        <div className={styles.cardHeading}>
          <div><span className="eyebrow"><CircleUserRound size={14} /> Entrenador en el circuito</span><h2>Participantes con oportunidad de acompañamiento</h2></div>
          <span>7 activas · 5 mostradas</span>
        </div>
        <div className={styles.table} role="table" aria-label="Cola de intervención humana">
          <div className={styles.tableHead} role="row"><span role="columnheader">Persona</span><span role="columnheader">Señal</span><span role="columnheader">Confianza</span><span role="columnheader">Recomendación</span><span role="columnheader">Acción</span></div>
          {learners.map((learner) => (
            <div className={styles.tableRow} role="row" key={learner.id} data-urgency={learner.urgency}>
              <span className={styles.person} role="cell"><i>{learner.initials}</i><strong>{learner.name}</strong></span>
              <span role="cell">{learner.signal}</span>
              <span role="cell">{learner.confidence}</span>
              <span role="cell">{learner.action}</span>
              <span role="cell">
                {learner.id === "mariana" ? (
                  <Link className={styles.openTwin} href="/studio/learners/mariana">Abrir <ArrowRight size={13} /></Link>
                ) : (
                  <button type="button" data-assigned={assigned.includes(learner.id)} onClick={() => assign(learner.id)}>
                    {assigned.includes(learner.id) ? <><Check size={14} /> Asignado</> : "Asignar"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
        <footer><p>Antes de la sesión, el entrenador recibe un resumen breve del objetivo, evidencia, intentos e intervenciones previas.</p><Link href="/studio/learners/mariana">Abrir gemelo de aprendizaje de Mariana <ArrowRight size={15} /></Link></footer>
      </section>
    </div>
  );
}
