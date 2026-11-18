"use client";

import { useState, useSyncExternalStore } from "react";
import { CalendarDays } from "lucide-react";
import {
  parseWeeklyPracticeTarget,
  weeklyPracticeStorageKey,
  WEEKLY_PRACTICE_TARGETS,
} from "@/lib/weekly-practice-intent";
import styles from "./weekly-practice-intent.module.css";

const CHANGE_EVENT = "luma-weekly-practice-intent-changed";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function readPreference(key: string | null): string | null {
  if (!key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function getServerSnapshot(): null { return null; }

/** Planning stays on this device; it never posts learning events or grants access. */
export function WeeklyPracticeIntent({ uid, nextMinutes }: { uid: string | null; nextMinutes: number }) {
  const [error, setError] = useState(false);
  const key = weeklyPracticeStorageKey(uid);
  const saved = useSyncExternalStore(subscribe, () => readPreference(key), getServerSnapshot);
  if (!key) return null;

  const target = parseWeeklyPracticeTarget(saved);
  const onChange = (nextValue: string) => {
    const next = parseWeeklyPracticeTarget(nextValue);
    try {
      window.localStorage.setItem(key, String(next));
      setError(false);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      setError(true);
    }
  };

  return (
    <section className={styles.card} aria-label="Mi objetivo semanal" data-testid="weekly-practice-intent">
      <CalendarDays size={19} aria-hidden="true" className={styles.icon} />
      <div className={styles.body}>
        <strong>Mi ritmo de aprendizaje</strong>
        <p>{target} prácticas por semana · próxima práctica: {nextMinutes} min</p>
        <small>Una meta personal en este dispositivo, no una calificación ni un avance certificado.</small>
        {error && <small role="alert">No se pudo guardar el objetivo en este dispositivo.</small>}
      </div>
      <label className={styles.field}>
        <span>Prácticas / semana</span>
        <select aria-label="Prácticas por semana" value={target} onChange={(event) => onChange(event.target.value)}>
          {WEEKLY_PRACTICE_TARGETS.map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
    </section>
  );
}
