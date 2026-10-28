"use client";

import { useCallback, useEffect, useState } from "react";
import { useLumaAuth } from "@/components/auth-provider";
import {
  readSelectedProgram, saveSelectedProgram,
  type ProgramAudience, type SelectableProgram,
} from "@/lib/program-selection";
import styles from "./program-picker.module.css";

type SelectionStatus = "loading" | "showcase" | "entitled" | "denied" | "error";
interface Snapshot {
  uid: string;
  status: SelectionStatus;
  courses: SelectableProgram[];
  programId: string | null;
}

const initial: Snapshot = { uid: "", status: "loading", courses: [], programId: null };

/** A shared selection contract for learner and coach, never an authorization source. */
export function useProgramSelection(audience: ProgramAudience) {
  const { user, loading } = useLumaAuth();
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [refreshCount, setRefreshCount] = useState(0);
  const uid = user?.uid ?? "";
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    const who = user.uid;
    const endpoint = audience === "coach" ? "/api/coach/programs" : "/api/programs/my-courses";
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch(endpoint, {
          headers: { authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status === 401 || response.status === 403) {
          setSnapshot({ uid: who, status: "denied", courses: [], programId: null });
          return;
        }
        if (!response.ok) throw new Error("program_list_failed");
        const body = (await response.json()) as {
          mode: "showcase" | "entitled"; courses: SelectableProgram[];
        };
        if (body.mode === "showcase") {
          setSnapshot({ uid: who, status: "showcase", courses: [], programId: null });
          return;
        }
        const courses = body.courses ?? [];
        const stored = readSelectedProgram(audience, who);
        const matching = courses.find((course) => course.programId === stored);
        const programId = matching?.programId ?? (courses.length === 1 ? courses[0].programId : null);
        if (programId) saveSelectedProgram(audience, who, programId);
        setSnapshot({ uid: who, status: "entitled", courses, programId });
      } catch {
        if (!cancelled) setSnapshot({ uid: who, status: "error", courses: [], programId: null });
      }
    })();
    return () => { cancelled = true; };
  }, [audience, loading, user, refreshCount]);

  const refresh = useCallback(() => {
    setSnapshot((previous) => ({ ...previous, status: "loading" }));
    setRefreshCount((previous) => previous + 1);
  }, []);

  const choose = useCallback((programId: string) => {
    const authorized = snapshot.uid === uid &&
      snapshot.status === "entitled" &&
      snapshot.courses.some((course) => course.programId === programId);
    if (!authorized) return;
    saveSelectedProgram(audience, uid, programId);
    setSnapshot((current) => ({ ...current, programId }));
  }, [audience, snapshot, uid]);

  const current = uid && snapshot.uid === uid
    ? snapshot
    : { ...initial, status: user ? "loading" as SelectionStatus : "showcase" as SelectionStatus };
  return { ...current, choose, refresh };
}

export function ProgramPicker({
  audience, selection,
}: {
  audience: ProgramAudience;
  selection: ReturnType<typeof useProgramSelection>;
}) {
  if (selection.status === "showcase") return null;
  const learner = audience === "learner";
  const title = learner ? "Tus cursos" : "Curso que vas a acompañar";
  return (
    <section id="luma-courses" className={styles.picker} aria-label={title}>
      <div className={styles.heading}>
        <span className="eyebrow">{learner ? "TU MATRÍCULA" : "SEGUIMIENTO ACADÉMICO"}</span>
        <h2>{title}</h2>
        <p>
          {learner
            ? "Selecciona el curso donde quieres continuar. Solo aparecen programas con acceso verificado."
            : "Elige el programa antes de consultar evidencia o decisiones de acompañamiento."}
        </p>
      </div>
      {selection.status === "loading" ? (
        <p role="status">Comprobando tus programas asignados…</p>
      ) : selection.status === "error" ? (
        <div className={styles.recovery} role="alert">
          <p>No pudimos verificar tus cursos. Revisa tu conexión e inténtalo de nuevo.</p>
          <button type="button" onClick={selection.refresh}>Reintentar</button>
        </div>
      ) : selection.status === "denied" ? (
        <p role="alert">Esta cuenta no tiene autorización para consultar estos programas.</p>
      ) : selection.courses.length === 0 ? (
        <div className={styles.recovery} role="status">
          <p>Aún no tienes cursos activos en esta organización. Consulta a tu administrador.</p>
          <button type="button" onClick={selection.refresh}>Actualizar matrículas</button>
        </div>
      ) : (
        <div className={styles.field}>
          <label htmlFor={"luma-program-" + audience}>Programa asignado</label>
          <select
            id={"luma-program-" + audience}
            value={selection.programId ?? ""}
            onChange={(event) => selection.choose(event.target.value)}
          >
            <option value="" disabled>Selecciona tu programa</option>
            {selection.courses.map((course) => (
              <option key={course.programId} value={course.programId}>
                {course.title}
              </option>
            ))}
          </select>
          <button type="button" className={styles.refresh} onClick={selection.refresh}>
            Actualizar cursos
          </button>
          {selection.programId && selection.courses.find(
            (course) => course.programId === selection.programId &&
              course.publishedOfferingAvailable === false,
          ) && (
            <p role="status">Tu acceso está activo, pero el catálogo del programa aún no está publicado.</p>
          )}
        </div>
      )}
    </section>
  );
}
