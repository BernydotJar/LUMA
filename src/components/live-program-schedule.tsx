"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink, Radio, RefreshCw } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import {
  fetchLearnerSchedule,
  type LearnerScheduledSession,
} from "@/lib/program-api-client";
import {
  programScheduleStatus,
  type ProgramScheduleStatus,
} from "@/lib/program-schedule-status";
import styles from "./live-program-schedule.module.css";

interface LearnerAgendaSnapshot {
  uid: string;
  status: ProgramScheduleStatus;
  items: LearnerScheduledSession[];
}

function sessionDate(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("es-CO", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(new Date(startsAt));
  } catch {
    return startsAt;
  }
}

export function LiveProgramSchedule() {
  const { user, loading } = useLumaAuth();
  const [snapshot, setSnapshot] = useState<LearnerAgendaSnapshot | null>(null);
  const [retry, setRetry] = useState(0);
  const uid = user?.uid;

  useEffect(() => {
    if (loading || !uid) return;
    let cancelled = false;

    void fetchLearnerSchedule()
      .then((items) => {
        if (!cancelled) {
          setSnapshot({
            uid,
            status: programScheduleStatus(items),
            items: items ?? [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot({ uid, status: "load_failed", items: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loading, uid, retry]);

  const current = !loading && uid && snapshot?.uid === uid ? snapshot : null;
  if (!current || current.status === "empty") return null;

  if (current.status === "load_failed" || current.status === "access_unverified") {
    return (
      <section
        className={`${styles.schedule} glass`}
        aria-labelledby="live-program-schedule-title"
        role="alert"
      >
        <div className={styles.heading}>
          <div>
            <span className="eyebrow"><Radio size={14} /> Agenda del programa</span>
            <h2 id="live-program-schedule-title">
              {current.status === "access_unverified"
                ? "No pudimos confirmar tu acceso a la agenda."
                : "No pudimos consultar tus próximas sesiones."}
            </h2>
            <p className={styles.statusNote}>
              {current.status === "access_unverified"
                ? "Verifica tu sesión o consulta al equipo del programa."
                : "La agenda está temporalmente indisponible. No podemos confirmar si tienes sesiones pendientes."}
            </p>
          </div>
          <button type="button" className={styles.retry} onClick={() => { setSnapshot(null); setRetry((value) => value + 1); }}>
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`${styles.schedule} glass`}
      aria-labelledby="live-program-schedule-title"
    >
      <div className={styles.heading}>
        <div>
          <span className="eyebrow"><Radio size={14} /> Próximas sesiones en vivo</span>
          <h2 id="live-program-schedule-title">Tu programa también ocurre en tiempo real.</h2>
        </div>
        <span>{current.items.length} próximas</span>
      </div>
      <div className={styles.sessions}>
        {current.items.slice(0, 4).map((item) => (
          <article
            className="glass-subtle"
            key={`${item.offeringId}:${item.session.sessionId}`}
          >
            <span className={styles.icon}><CalendarClock size={18} /></span>
            <div>
              <small>{item.offeringTitle}</small>
              <strong>{item.session.title}</strong>
              <p>
                {sessionDate(item.session.startsAt, item.timezone)}
                {" "}· {item.session.durationMinutes} min
              </p>
            </div>
            {item.session.classroomProvider === "livekit" ? (
              <Link href={`/classroom/${encodeURIComponent(item.offeringId)}/${encodeURIComponent(item.session.sessionId)}`} aria-label={`Entrar al aula de ${item.session.title}`}>
                Abrir aula <Radio size={14} />
              </Link>
            ) : item.session.joinUrl ? (
              <a
                href={item.session.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Entrar a ${item.session.title}`}
              >
                Entrar <ExternalLink size={14} />
              </a>
            ) : (
              <span className={styles.pending}>Enlace pendiente</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
