"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ExternalLink, Radio } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import {
  fetchLearnerSchedule,
  type LearnerScheduledSession,
} from "@/lib/program-api-client";
import styles from "./live-program-schedule.module.css";

function sessionDate(
  startsAt: string,
  timezone: string,
): string {
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
  const [schedule, setSchedule] = useState<
    LearnerScheduledSession[] | null
  >(null);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;
    void fetchLearnerSchedule()
      .then((items) => {
        if (!cancelled) setSchedule(items ?? []);
      })
      .catch(() => {
        if (!cancelled) setSchedule([]);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  if (!user || !schedule?.length) return null;

  return (
    <section
      className={`${styles.schedule} glass`}
      aria-labelledby="live-program-schedule-title"
    >
      <div className={styles.heading}>
        <div>
          <span className="eyebrow">
            <Radio size={14} /> Próximas sesiones en vivo
          </span>
          <h2 id="live-program-schedule-title">
            Tu programa también ocurre en tiempo real.
          </h2>
        </div>
        <span>{schedule.length} próximas</span>
      </div>

      <div className={styles.sessions}>
        {schedule.slice(0, 4).map((item) => (
          <article
            className="glass-subtle"
            key={`${item.offeringId}:${item.session.sessionId}`}
          >
            <span className={styles.icon}>
              <CalendarClock size={18} />
            </span>
            <div>
              <small>{item.offeringTitle}</small>
              <strong>{item.session.title}</strong>
              <p>
                {sessionDate(
                  item.session.startsAt,
                  item.timezone,
                )}{" "}
                · {item.session.durationMinutes} min
              </p>
            </div>
            {item.session.joinUrl ? (
              <a
                href={item.session.joinUrl}
                target="_blank"
                rel="noreferrer"
              >
                Entrar <ExternalLink size={14} />
              </a>
            ) : (
              <span className={styles.pending}>
                Enlace pendiente
              </span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
