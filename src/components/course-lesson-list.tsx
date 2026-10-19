"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, Check, Clock3, LockKeyhole, PlayCircle, RefreshCw } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import { firebaseAuth } from "@/lib/firebase-client";
import type { CourseLessonSummary, LessonCheckpoint } from "@/lib/course-delivery";
import styles from "@/app/learn/course/course.module.css";

type ListedLesson = CourseLessonSummary & { checkpoint: LessonCheckpoint | null };
type LessonResponse = { lessons: ListedLesson[]; nextCursor: string | null };
type ListingState = "idle" | "loading" | "ready" | "needs_access" | "selection" | "unavailable" | "error";

function learningPosition(lesson: ListedLesson) {
  const checkpoint = lesson.checkpoint;
  if (!checkpoint || checkpoint.lessonRevision !== lesson.revision) return "Sin comenzar";
  if (checkpoint.status === "reached_end") return "Contenido recorrido";
  return lesson.kind === "video"
    ? `Continúa desde ${Math.floor(checkpoint.furthestUnit / 60)} min`
    : `Continúa en página ${Math.max(1, checkpoint.furthestUnit)}`;
}

/** Remount on Firebase identity change so no prior learner's course or media flashes. */
export function CourseLessonList() {
  const { user, loading } = useLumaAuth();
  return <CourseLessonListForIdentity key={user?.uid ?? "guest"} user={user} loading={loading} />;
}

function CourseLessonListForIdentity({ user, loading }: {
  user: ReturnType<typeof useLumaAuth>["user"];
  loading: boolean;
}) {
  const [state, setState] = useState<ListingState>("idle");
  const [items, setItems] = useState<ListedLesson[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const uid = user?.uid;
    if (loading || !uid) return;
    let cancelled = false;
    void (async () => {
      setState("loading");
      try {
        const current = firebaseAuth.currentUser;
        if (!current || current.uid !== uid) return;
        const token = await current.getIdToken();
        if (firebaseAuth.currentUser?.uid !== uid) return;
        const response = await fetch("/api/learning/course", {
          cache: "no-store", headers: { authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (response.status === 403) return setState("needs_access");
        if (response.status === 409) return setState("selection");
        if (response.status === 503) return setState("unavailable");
        if (!response.ok) return setState("error");
        const data = await response.json() as LessonResponse;
        if (cancelled || firebaseAuth.currentUser?.uid !== uid) return;
        setItems(data.lessons);
        setCursor(data.nextCursor);
        setState("ready");
      } catch { if (!cancelled) setState("error"); }
    })();
    return () => { cancelled = true; };
  }, [loading, user?.uid]);

  async function loadMore() {
    const uid = user?.uid;
    const current = firebaseAuth.currentUser;
    if (!uid || !cursor || !current || current.uid !== uid || busy) return;
    setBusy(true);
    try {
      const token = await current.getIdToken();
      if (firebaseAuth.currentUser?.uid !== uid) return;
      const response = await fetch(`/api/learning/course?cursor=${encodeURIComponent(cursor)}`, {
        cache: "no-store", headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("COURSE_PAGE_FAILED");
      const page = await response.json() as LessonResponse;
      if (firebaseAuth.currentUser?.uid !== uid) return;
      setItems((previous) => [...previous, ...page.lessons]);
      setCursor(page.nextCursor);
    } catch { setState("error"); }
    finally { setBusy(false); }
  }

  if (loading || (user && ["idle", "loading"].includes(state))) {
    return <section className={styles.empty} role="status">Comprobando tu programa y las lecciones publicadas…</section>;
  }
  if (!user) return (
    <section className={styles.empty}>
      <LockKeyhole size={24} aria-hidden="true" />
      <h2>Tu curso empieza cuando accedes.</h2>
      <p>Inicia sesión con el correo vinculado a tu matrícula para encontrar las lecciones autorizadas.</p>
      <Link className="button-primary" href="/login">Iniciar sesión <ArrowRight size={16} /></Link>
    </section>
  );
  if (state !== "ready") {
    const message = state === "needs_access"
      ? ["Aún no encontramos una matrícula activa", "Comprueba el correo de tu compra o solicita ayuda a tu institución."]
      : state === "selection"
        ? ["Tienes varios programas", "La selección de programa se habilitará con una vista de matrículas verificada."]
        : state === "unavailable"
          ? ["Las lecciones todavía no están habilitadas aquí", "Puedes seguir con las prácticas disponibles mientras la institución prepara la publicación."]
          : ["No pudimos cargar las lecciones", "Tu avance no se ha perdido. Vuelve a intentarlo cuando la conexión esté disponible."];
    return <section className={styles.empty} role="status"><LockKeyhole size={24} aria-hidden="true" />
      <h2>{message[0]}</h2><p>{message[1]}</p>
      <Link href="/learn/experiences" className="button-secondary">Ir a prácticas <ArrowRight size={16} /></Link>
    </section>;
  }
  if (items.length === 0 && cursor) return (
    <section className={styles.empty} role="status">
      <BookOpen size={28} aria-hidden="true" />
      <h2>Estamos verificando las siguientes lecciones.</h2>
      <p>Esta parte del catálogo aún no contiene recursos publicables. Puedes continuar con la siguiente sección sin mostrar materiales pendientes de aprobación.</p>
      <button type="button" className="button-primary" disabled={busy} onClick={() => void loadMore()}>
        <RefreshCw size={16} /> {busy ? "Verificando…" : "Verificar siguientes lecciones"}
      </button>
    </section>
  );
  if (items.length === 0) return (
    <section className={styles.empty} data-testid="course-no-lessons">
      <BookOpen size={28} aria-hidden="true" />
      <h2>Tu programa está en preparación.</h2>
      <p>Tienes acceso al curso, pero todavía no hay lecciones revisadas y publicadas en esta sección. No mostraremos contenidos incompletos como si ya estuvieran disponibles.</p>
      <Link href="/learn/experiences" className="button-primary">Explorar prácticas disponibles <ArrowRight size={16} /></Link>
    </section>
  );
  const next = items.find((lesson) => lesson.checkpoint?.status === "started" && lesson.checkpoint.lessonRevision === lesson.revision)
    ?? items.find((lesson) => lesson.checkpoint?.status !== "reached_end" || lesson.checkpoint.lessonRevision !== lesson.revision)
    ?? items[0];
  const completed = items.filter((lesson) => lesson.checkpoint?.status === "reached_end" && lesson.checkpoint.lessonRevision === lesson.revision).length;
  return (
    <section className={styles.listArea}>
      <div className={styles.featured}>
        <div><span className="eyebrow">TU SIGUIENTE LECCIÓN</span><h2>{next.title}</h2><p>{next.summary}</p>
          <span className={styles.miniState}><Clock3 size={15} />{learningPosition(next)}</span></div>
        <Link className="button-primary" href={`/learn/course/${encodeURIComponent(next.lessonId)}`}>
          {next.checkpoint?.furthestUnit ? "Retomar lección" : "Comenzar lección"} <ArrowRight size={17} />
        </Link>
      </div>
      <div className={styles.sectionLead}><div><span className="eyebrow">LECCIONES PUBLICADAS</span><h2>Tu material, en orden.</h2></div>
        <p>{completed} de {items.length} recorridas <small>Consumo de contenido, no evaluación de competencias</small></p>
      </div>
      <ol className={styles.lessonList}>
        {items.map((lesson) => (
          <li key={lesson.lessonId}>
            <Link href={`/learn/course/${encodeURIComponent(lesson.lessonId)}`} aria-label={`Abrir lección: ${lesson.title}`}>
              <span className={styles.lessonIcon}>{lesson.kind === "video" ? <PlayCircle size={19} /> : <BookOpen size={19} />}</span>
              <span className={styles.lessonDescription}><small>{lesson.moduleId.replaceAll("-", " ")} · {lesson.kind === "video" ? "Video" : "Documento"}</small><strong>{lesson.title}</strong><span>{learningPosition(lesson)}</span></span>
              {lesson.checkpoint?.status === "reached_end" && lesson.checkpoint.lessonRevision === lesson.revision
                ? <Check size={19} aria-label="Contenido recorrido" /> : <ArrowRight size={18} aria-hidden="true" />}
            </Link>
          </li>
        ))}
      </ol>
      {cursor && <button className="button-secondary" type="button" disabled={busy} onClick={() => void loadMore()}>
        <RefreshCw size={15} /> {busy ? "Cargando…" : "Ver más lecciones"}
      </button>}
    </section>
  );
}
