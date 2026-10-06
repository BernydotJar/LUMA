"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  Clock3,
  Database,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import {
  fetchCoachLearner,
  type CoachLearnerDetail,
} from "@/lib/coach-api-client";
import styles from "./persistent-twin-detail.module.css";
function eventEvidenceSummary(event: Record<string, unknown>) {
  const category = typeof event.evidenceCategory === "string" ? event.evidenceCategory : undefined;
  const rubric = typeof event.rubricId === "string" ? event.rubricId : undefined;
  const criteria = Array.isArray(event.criteria) ? event.criteria : [];
  const passed = criteria.filter((item) => Boolean((item as Record<string, unknown>).passed)).length;
  const pieces = [
    category === "scored" ? "evidencia puntuada" : category,
    rubric ? `rúbrica ${rubric}` : undefined,
    criteria.length ? `${passed}/${criteria.length} criterios` : undefined,
  ].filter(Boolean);
  return pieces.join(" · ");
}


export function PersistentTwinDetail({ learnerId }: { learnerId: string }) {
  const { user, loading } = useLumaAuth();
  const [detail, setDetail] = useState<CoachLearnerDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "forbidden" | "error">("loading");

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;
    void fetchCoachLearner(learnerId)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setState("forbidden");
          return;
        }
        setDetail(result);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [learnerId, loading, user]);

  const viewState = !loading && !user ? "forbidden" : state;

  const averageMastery = useMemo(() => {
    if (!detail) return 0;
    const concepts = detail.record.state.concepts;
    if (!concepts.length) return 0;
    return Math.round(
      (concepts.reduce((sum, concept) => sum + concept.mastery, 0) / concepts.length) * 100,
    );
  }, [detail]);

  if (viewState === "loading") {
    return (
      <section className={`${styles.stateCard} glass`} role="status">
        <Sparkles size={22} />
        <div>
          <strong>Cargando Learning Twin persistente</strong>
          <p>Verificando autorización y evidencia del participante.</p>
        </div>
      </section>
    );
  }

  if (viewState === "forbidden") {
    return (
      <section className={`${styles.stateCard} glass`}>
        <ShieldCheck size={24} />
        <div>
          <strong>Vista protegida del entrenador</strong>
          <p>Esta ruta requiere un token Firebase con claim de coach, admin o superuser.</p>
        </div>
      </section>
    );
  }

  if (viewState === "error" || !detail) {
    return (
      <section className={`${styles.stateCard} glass`} role="alert">
        <AlertTriangle size={24} />
        <div>
          <strong>No se pudo cargar la evidencia persistente.</strong>
          <p>El showcase no sustituye datos reales en esta ruta.</p>
        </div>
      </section>
    );
  }

  const { record, plan, events } = detail;
  const pas = record.state.concepts.find((concept) => concept.conceptId === "pas");

  return (
    <div className={styles.layout}>
      <section className={`${styles.hero} glass`}>
        <div>
          <span className="eyebrow"><Database size={14} /> Fuente autoritativa · Firestore</span>
          <h2>{record.state.goal}</h2>
          <p>
            Este estado proviene de <code>learners/{record.learnerId}</code> y usa el mismo
            motor que decide la siguiente acción del participante.
          </p>
          <div className={styles.meta}>
            <span><ShieldCheck size={14} /> UID verificado</span>
            <span><Clock3 size={14} /> v{record.version}</span>
            <span><BookOpenCheck size={14} /> {events.length} eventos recientes</span>
          </div>
        </div>
        <div className={styles.score}>
          <strong>{averageMastery}%</strong>
          <span>dominio medio</span>
        </div>
      </section>

      {plan.routeChanged && plan.previousAction && (
        <section className={styles.routeChange}>
          <Sparkles size={19} />
          <div>
            <strong>La evidencia cambió la ruta.</strong>
            <p>{plan.previousAction.title} → {plan.nextAction.title}</p>
          </div>
        </section>
      )}

      <div className={styles.grid}>
        <section className={`${styles.panel} glass`}>
          <span className="eyebrow"><Target size={14} /> Siguiente mejor acción</span>
          <h3>{plan.nextAction.title}</h3>
          <p>{plan.nextAction.reason}</p>
          <dl>
            <div><dt>Tipo</dt><dd>{plan.nextAction.kind}</dd></div>
            <div><dt>Duración</dt><dd>{plan.nextAction.minutes} min</dd></div>
            <div><dt>Concepto</dt><dd>{plan.nextAction.conceptId}</dd></div>
            <div><dt>Confianza</dt><dd>{Math.round(plan.nextAction.confidence * 100)}%</dd></div>
          </dl>
        </section>

        <section className={`${styles.panel} glass`}>
          <span className="eyebrow"><Sparkles size={14} /> Estado P.A.S.</span>
          <h3>{pas ? Math.round(pas.mastery * 100) : 0}% dominio</h3>
          <p>
            {pas?.completedContent
              ? "Hay evidencia de transferencia; completar contenido no fue suficiente por sí solo."
              : "La siguiente señal útil sigue siendo demostrar transferencia."}
          </p>
          <dl>
            <div><dt>Intentos</dt><dd>{pas?.attempts ?? 0}</dd></div>
            <div><dt>Confianza</dt><dd>{Math.round((pas?.confidence ?? 0) * 100)}%</dd></div>
            <div><dt>Fallos consecutivos</dt><dd>{pas?.consecutiveFailures ?? 0}</dd></div>
          </dl>
        </section>
      </div>

      <section className={`${styles.events} glass`}>
        <div className={styles.heading}>
          <div>
            <span className="eyebrow"><Database size={14} /> Ledger append-only</span>
            <h3>Evidencia reciente</h3>
          </div>
          <span>{events.length} eventos</span>
        </div>
        {events.length ? (
          <div className={styles.eventList}>
            {events.map((event, index) => (
              <article key={String(event.id ?? index)}>
                <Check size={15} />
                <div>
                  <strong>{String(event.type ?? "LEARNING_EVENT")}</strong>
                  <p>
                    Concepto {String(event.conceptId ?? "—")} · evento {String(event.eventId ?? event.id ?? "—")}
                    {eventEvidenceSummary(event) ? ` · ${eventEvidenceSummary(event)}` : ""}
                  </p>
                </div>
                <small>{String(event.recordedAt ?? event.completedAt ?? "sin fecha")}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>Todavía no hay eventos persistidos para este journey.</p>
        )}
      </section>
    </div>
  );
}
