"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, BookOpenCheck, CircleUserRound, Clock3,
  MessageSquareText, ShieldCheck, TrendingUp, Users,
} from "lucide-react";
import { fetchCoachInterventions, fetchCoachLearners, type CoachInterventionSignal, type CoachLearnerSummary } from "@/lib/coach-api-client";
import { deriveCoachDataStatus } from "@/lib/coach-data-status";
import { useLumaAuth } from "@/components/auth-provider";
import { SemanticObject } from "@/components/semantic-object";
import styles from "./studio-dashboard.module.css";

type CoachSnapshot = {
  uid: string;
  learners?: CoachLearnerSummary[];
  interventions?: CoachInterventionSignal[];
  error: boolean;
};

function formattedDate(value: string | undefined) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";
  return new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(date);
}

function priorityLabel(priority: CoachInterventionSignal["priority"]) {
  return priority === "high" ? "Alta" : priority === "medium" ? "Media" : "Baja";
}

export function StudioDashboard() {
  const { user, loading } = useLumaAuth();
  const [snapshot, setSnapshot] = useState<CoachSnapshot | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const uid = user.uid;
    void Promise.allSettled([fetchCoachLearners(), fetchCoachInterventions()])
      .then(([learnerResult, interventionResult]) => {
        if (cancelled) return;
        setSnapshot({
          uid,
          learners: learnerResult.status === "fulfilled" ? learnerResult.value : undefined,
          interventions: interventionResult.status === "fulfilled" ? interventionResult.value : undefined,
          error: learnerResult.status === "rejected" || interventionResult.status === "rejected",
        });
      });
    return () => { cancelled = true; };
  }, [loading, user]);

  const current = user && snapshot?.uid === user.uid ? snapshot : null;
  const authenticated = Boolean(user);
  const hasInterventions = current?.interventions !== undefined;
  const coachDataStatus = deriveCoachDataStatus(current);
  const available = coachDataStatus === "ready" || coachDataStatus === "partial";
  const incomplete = coachDataStatus === "partial";
  const interventions = useMemo(() => current?.interventions ?? [], [current]);
  const priorityHigh = interventions.filter((item) => item.priority === "high").length;
  const priorityMedium = interventions.filter((item) => item.priority === "medium").length;
  const lastUpdate = interventions.map((item) => item.updatedAt).filter(Boolean).sort().at(-1);
  const selected = interventions.find((item) => item.learnerId === selectedLearnerId) ?? interventions[0];

  return (
    <div className={styles.dashboard}>
      <section className={styles.controlBar}>
        <div>
          <span className="status-pill" data-tone={available && !incomplete ? "positive" : "warning"}>
            {available && !incomplete ? "Información de seguimiento disponible" : incomplete ? "Información parcial" : "Acceso al seguimiento"}
          </span>
          <span>Las señales se muestran únicamente con acceso autorizado</span>
        </div>
        <div><Link className="button-secondary" href="/studio/class-intelligence"><BookOpenCheck size={15} /> Revisar experiencias <ArrowRight size={14} /></Link></div>
      </section>

      <section className={styles.metricGrid} aria-label="Resumen operativo">
        <article className={`${styles.heroMetric} content-surface`}>
          <span className={styles.metricIcon}><TrendingUp size={22} /></span>
          <div>
            <small>Participantes consultados</small>
            <strong>{current?.learners ? current.learners.length : "—"}</strong>
            <p>Registros accesibles a tu cuenta, no el total de la organización</p>
          </div>
          <SemanticObject variant="strata" size="sm" className={styles.insightObject} />
        </article>
        {[
          { label: "Señales de acompañamiento", value: current?.interventions ? interventions.length : "—", detail: "Casos devueltos por el sistema de seguimiento", icon: Users },
          { label: "Prioridad alta", value: current?.interventions ? priorityHigh : "—", detail: "Dentro de las señales consultadas", icon: AlertTriangle },
          { label: "Última actualización", value: current?.interventions ? formattedDate(lastUpdate) : "—", detail: "Fecha del registro más reciente disponible", icon: Clock3 },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <article className="glass-subtle" key={metric.label}>
              <span><Icon size={19} /></span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <p>{metric.detail}</p>
            </article>
          );
        })}
      </section>

      {available && incomplete && (
        <section className={`${styles.interventionQueue} content-surface`} role="alert">
          <h2>Algunos datos de seguimiento no están disponibles.</h2>
          <p>
            Una consulta incompleta no significa que no haya participantes ni intervenciones pendientes.
            Las cifras no disponibles se muestran como «—». Vuelve a consultar o contacta al administrador.
          </p>
        </section>
      )}

      {!authenticated ? (
        <section className={`${styles.interventionQueue} content-surface`} role="status">
          <h2>Accede para consultar a tus participantes.</h2>
          <p>El seguimiento individual utiliza permisos de entrenador y presenta únicamente evidencia autorizada.</p>
          <Link className="button-primary" href="/login">Iniciar sesión <ArrowRight size={16} /></Link>
        </section>
      ) : loading || !current ? (
        <section className={`${styles.interventionQueue} content-surface`} role="status">
          <h2>Cargando información de seguimiento…</h2>
          <p>Consultando únicamente los registros que puedes revisar.</p>
        </section>
      ) : !available ? (
        <section className={`${styles.interventionQueue} content-surface`} role="status">
          <h2>{current.error ? "No fue posible consultar el seguimiento." : "Tu cuenta aún no tiene acceso a este seguimiento."}</h2>
          <p>{current.error
            ? "El servicio no respondió correctamente. No podemos confirmar el estado de las intervenciones; inténtalo de nuevo."
            : "Solicita a un administrador que habilite el perfil de entrenador y el alcance de participantes correspondiente."}</p>
        </section>
      ) : (
        <>
          <div className={styles.mainGrid}>
            <section className={`${styles.bottleneckCard} content-surface`}>
              <div className={styles.cardHeading}>
                <div>
                  <span className="eyebrow"><AlertTriangle size={14} /> Prioridades de acompañamiento</span>
                  <h2>Decide dónde intervenir a partir de señales disponibles.</h2>
                </div>
                <span className="status-pill" data-tone={priorityHigh ? "warning" : "positive"}>
                  {hasInterventions ? `${priorityHigh} alta · ${priorityMedium} media` : "Datos no disponibles"}
                </span>
              </div>
              {!hasInterventions ? (
                <p role="status">Las prioridades no están disponibles. No es posible confirmar intervenciones pendientes.</p>
              ) : interventions.length ? (
                <div className={styles.bottleneckLayout}>
                  <div className={styles.bottleneckChart}>
                    {interventions.map((item) => (
                      <button
                        type="button"
                        key={item.learnerId}
                        data-selected={selected?.learnerId === item.learnerId}
                        onClick={() => setSelectedLearnerId(item.learnerId)}
                      >
                        <span>Participante {item.learnerId.slice(0, 6)}</span>
                        <div><i style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} /></div>
                        <strong>Prioridad {priorityLabel(item.priority)}</strong>
                      </button>
                    ))}
                  </div>
                  {selected && (
                    <div className={styles.insightPanel} data-severity={selected.priority}>
                      <SemanticObject variant="strata" size="sm" className={styles.insightObject} />
                      <span>Señal disponible</span>
                      <h3>Participante {selected.learnerId.slice(0, 6)}</h3>
                      <p>{selected.reasons.join(". ") || "Revisar el progreso de esta persona."}</p>
                      <dl>
                        <div><dt>Prioridad</dt><dd>{priorityLabel(selected.priority)}</dd></div>
                        <div><dt>Actualizada</dt><dd>{formattedDate(selected.updatedAt)}</dd></div>
                      </dl>
                      <p>{selected.recommendation}</p>
                      <Link className="button-secondary" href={`/studio/learners/${encodeURIComponent(selected.learnerId)}`}>Revisar evidencia <ArrowRight size={15} /></Link>
                    </div>
                  )}
                </div>
              ) : (
                <p>No hay señales de intervención para el alcance consultado.</p>
              )}
            </section>

            <aside className={styles.sideColumn}>
              <section className={`${styles.qualityCard} content-surface`}>
                <div className={styles.cardHeading}><div><span className="eyebrow"><ShieldCheck size={14} /> Criterio de seguimiento</span><h2>Decisiones con evidencia</h2></div></div>
                <p>Las señales orientan la intervención. El entrenador revisa el contexto y confirma qué apoyo resulta adecuado.</p>
              </section>
              <section className={`${styles.questionCard} content-surface`}>
                <span className="eyebrow"><MessageSquareText size={14} /> Tutoría guiada</span>
                <h2>Ayudar a comprender es parte del aprendizaje.</h2>
                <p>Las preguntas, la práctica y los nuevos intentos ayudan a distinguir una respuesta acertada de una capacidad consolidada.</p>
                <Link className="button-secondary" href="/studio/class-intelligence">Revisar objetivos de aprendizaje <ArrowRight size={15} /></Link>
              </section>
            </aside>
          </div>

          <section className={`${styles.interventionQueue} content-surface`}>
            <SemanticObject variant="bridge" size="sm" className={styles.interventionObject} />
            <div className={styles.cardHeading}>
              <div><span className="eyebrow"><CircleUserRound size={14} /> Seguimiento individual</span><h2>Participantes que necesitan acompañamiento</h2></div>
              <span>{hasInterventions ? `${interventions.length} señales disponibles` : "Sin datos de intervención"}</span>
            </div>
            {!hasInterventions ? (
              <p role="status">No se pudo consultar la cola. Su estado es desconocido, no cero.</p>
            ) : interventions.length ? (
              <div className={styles.table} role="table" aria-label="Señales de acompañamiento">
                <div className={styles.tableHead} role="row"><span role="columnheader">Persona</span><span role="columnheader">Señal</span><span role="columnheader">Prioridad</span><span role="columnheader">Recomendación</span><span role="columnheader">Acción</span></div>
                {interventions.map((item) => (
                  <div className={styles.tableRow} role="row" key={item.learnerId} data-urgency={item.priority}>
                    <span className={styles.person} role="cell"><i>LI</i><strong>Participante {item.learnerId.slice(0, 6)}</strong></span>
                    <span role="cell">{item.reasons[0] ?? "Revisión sugerida"}</span>
                    <span role="cell">{priorityLabel(item.priority)}</span>
                    <span role="cell">{item.recommendation}</span>
                    <span role="cell"><Link className={styles.openTwin} href={`/studio/learners/${encodeURIComponent(item.learnerId)}`}>Revisar <ArrowRight size={13} /></Link></span>
                  </div>
                ))}
              </div>
            ) : <p>No hay intervenciones pendientes en esta consulta.</p>}
            <footer><p>Estas señales son una muestra de seguimiento, no una medición del conjunto de la organización ni una prueba de impacto empresarial.</p></footer>
          </section>
        </>
      )}
    </div>
  );
}
