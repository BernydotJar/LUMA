"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Clock3, LockKeyhole, PlayCircle, RefreshCw, Save } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import { captureLearnerRequestScope, learnerProgramHeaders, assertLearnerRequestScope } from "@/lib/learner-program-request";
import { useProgramSelection } from "@/components/program-picker";
import type { CourseLessonSummary, LessonCheckpoint } from "@/lib/course-delivery";
import styles from "@/app/learn/course/player.module.css";

type MediaResponse = { url: string; expiresAt: string; contentType: string };
type PlayerState = "loading" | "ready" | "not_available" | "needs_access" | "unavailable" | "error";

function description(state: PlayerState): [string, string] {
  switch (state) {
    case "not_available": return ["Esta lección no está publicada", "El equipo docente debe revisar y autorizar el contenido antes de que puedas acceder."];
    case "needs_access": return ["Tu matrícula necesita verificación", "Este recurso es exclusivo del programa correspondiente. Comprueba la compra y tu correo de acceso."];
    case "unavailable": return ["El contenido no está habilitado aquí", "Puedes continuar con las actividades disponibles mientras se prepara la publicación segura."];
    default: return ["No pudimos abrir esta lección", "No atribuiremos ningún avance mientras no se pueda verificar el contenido y tu sesión."];
  }
}

/** Keys prevent a video URL, transcript or checkpoint crossing an account switch. */
export function CourseLessonPlayer({ lessonId }: { lessonId: string }) {
  const { user, loading } = useLumaAuth();
  const selection = useProgramSelection("learner");
  const selected = selection.status === "showcase" || (selection.status === "entitled" && Boolean(selection.programId));
  return <CourseLessonPlayerForIdentity key={`${user?.uid ?? "guest"}:${lessonId}:${selection.status}:${selection.programId ?? "none"}`}
    lessonId={lessonId} user={user} loading={loading || (Boolean(user) && selection.status === "loading")}
    programId={selection.status === "entitled" ? selection.programId : null} selected={selected} />;
}

function CourseLessonPlayerForIdentity({ lessonId, user, loading, programId, selected }: {
  lessonId: string;
  user: ReturnType<typeof useLumaAuth>["user"];
  loading: boolean;
  programId: string | null;
  selected: boolean;
}) {
  const [state, setState] = useState<PlayerState>("loading");
  const [lesson, setLesson] = useState<CourseLessonSummary | null>(null);
  const [checkpoint, setCheckpoint] = useState<LessonCheckpoint | null>(null);
  const [media, setMedia] = useState<MediaResponse | null>(null);
  const [mediaState, setMediaState] = useState<"idle" | "loading" | "unavailable">("idle");
  const [checkpointStatus, setCheckpointStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [documentPage, setDocumentPage] = useState(1);
  const lastSaveAt = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const uid = user?.uid;
    if (loading || !uid) return;
    if (!selected) return;
    let cancelled = false;
    void (async () => {
      try {
        const scope = captureLearnerRequestScope(uid, programId);
        const headers = await learnerProgramHeaders(scope);
        const response = await fetch(`/api/learning/course/${encodeURIComponent(lessonId)}`, {
          cache: "no-store", headers,
        });
        if (cancelled) return;
        if (response.status === 404) return setState("not_available");
        if (response.status === 403 || response.status === 409) return setState("needs_access");
        if (response.status === 503) return setState("unavailable");
        if (!response.ok) return setState("error");
        const data = await response.json() as { lesson: CourseLessonSummary; checkpoint: LessonCheckpoint | null };
        if (cancelled) return;
        assertLearnerRequestScope(scope);
        setLesson(data.lesson);
        const validCheckpoint = data.checkpoint?.lessonRevision === data.lesson.revision ? data.checkpoint : null;
        setCheckpoint(validCheckpoint);
        setDocumentPage(Math.max(1, validCheckpoint?.furthestUnit ?? 1));
        setState("ready");
      } catch { if (!cancelled) setState("error"); }
    })();
    return () => { cancelled = true; };
  }, [lessonId, loading, user?.uid, programId, selected]);

  async function requestMedia() {
    const uid = user?.uid;
    if (!uid || !lesson || !selected) return;
    setMediaState("loading");
    setMedia(null);
    try {
      const scope = captureLearnerRequestScope(uid, programId);
      const headers = await learnerProgramHeaders(scope);
      const response = await fetch(`/api/learning/course/${encodeURIComponent(lessonId)}/asset`, {
        cache: "no-store", headers,
      });
      if (!response.ok) throw new Error("MEDIA_NOT_AVAILABLE");
      const asset = await response.json() as MediaResponse;
      assertLearnerRequestScope(scope);
      setMedia(asset);
      setMediaState("idle");
    } catch { setMediaState("unavailable"); }
  }

  async function save(unit: number) {
    const uid = user?.uid;
    if (!lesson || !uid || !selected) return;
    setCheckpointStatus("saving");
    try {
      const scope = captureLearnerRequestScope(uid, programId);
      const headers = await learnerProgramHeaders(scope, true);
      const response = await fetch(`/api/learning/course/${encodeURIComponent(lessonId)}/checkpoint`, {
        method: "POST", cache: "no-store", headers,
        body: JSON.stringify({ lessonRevision: lesson.revision,
          positionUnit: Math.max(0, Math.min(lesson.totalUnits, Math.floor(unit))), writeId: crypto.randomUUID() }),
      });
      if (!response.ok) throw new Error("CHECKPOINT_NOT_SAVED");
      const result = await response.json() as { checkpoint: LessonCheckpoint };
      assertLearnerRequestScope(scope);
      setCheckpoint(result.checkpoint);
      setCheckpointStatus("saved");
    } catch { setCheckpointStatus("failed"); }
  }

  const onTimeUpdate = (position: number) => {
    if (Date.now() - lastSaveAt.current < 30_000 || position < 3) return;
    lastSaveAt.current = Date.now();
    void save(position);
  };

  const viewState: PlayerState = selected ? state : "needs_access";
  if (loading || (user && viewState === "loading")) {
    return <section className={styles.message} role="status">Verificando la matrícula y la disponibilidad del recurso…</section>;
  }
  if (!user) return <section className={styles.message}><LockKeyhole size={24} aria-hidden="true" />
    <h2>Accede para abrir tu lección</h2><p>Utiliza la cuenta vinculada a tu compra.</p>
    <Link href="/login" className="button-primary">Iniciar sesión <ArrowRight size={16} /></Link>
  </section>;
  if (viewState !== "ready" || !lesson) {
    const [title, body] = description(viewState);
    return <section className={styles.message} role="status"><LockKeyhole size={24} aria-hidden="true" />
      <h2>{title}</h2><p>{body}</p>
      <Link href="/learn/course" className="button-secondary">Ver mis lecciones <ArrowRight size={16} /></Link>
    </section>;
  }
  const progress = checkpoint?.furthestUnit ?? 0;
  const progression = Math.round((progress / lesson.totalUnits) * 100);
  return (
    <article className={styles.player}>
      <Link className={styles.back} href="/learn/course"><ArrowLeft size={16} aria-hidden="true" /> Volver a mis lecciones</Link>
      <header className={styles.header}>
        <span className="eyebrow">{lesson.moduleId.replaceAll("-", " ")} · {lesson.kind === "video" ? "VIDEO" : "DOCUMENTO"}</span>
        <h1>{lesson.title}</h1>
        <p>{lesson.summary}</p>
        <div className={styles.attributes}>
          <span><Clock3 size={15} /> {lesson.kind === "video" ? `${Math.ceil(lesson.totalUnits / 60)} min` : `${lesson.totalUnits} páginas`}</span>
          <span><BookOpen size={15} /> Versión editorial {lesson.revision}</span>
          {checkpoint && <span>{progression}% recorrido (no equivale a dominio)</span>}
        </div>
      </header>
      <section className={styles.mediaPanel} aria-label="Contenido de la lección">
        {!media && <div className={styles.mediaEmpty}>
          {lesson.kind === "video" ? <PlayCircle size={39} aria-hidden="true" /> : <BookOpen size={39} aria-hidden="true" />}
          <h2>{mediaState === "unavailable" ? "Este archivo no está disponible por ahora" : "Contenido de acceso protegido"}</h2>
          <p>{mediaState === "unavailable" ? "No se encontró una entrega autorizada del recurso. Tu avance anterior se conserva." : "El enlace se emite para tu sesión y tiene una duración limitada. No exponemos archivos originales sin comprobar la matrícula."}</p>
          <button className="button-primary" type="button" disabled={mediaState === "loading"} onClick={() => void requestMedia()}>
            <RefreshCw size={16} /> {mediaState === "loading" ? "Verificando el archivo…" : mediaState === "unavailable" ? "Volver a intentar" : "Abrir lección"}
          </button>
        </div>}
        {media && lesson.kind === "video" && <video
          ref={videoRef} key={media.url} className={styles.video} controls playsInline preload="metadata"
          src={media.url}
          onLoadedMetadata={() => {
            if (videoRef.current && checkpoint?.lessonRevision === lesson.revision && checkpoint.furthestUnit < lesson.totalUnits) {
              videoRef.current.currentTime = checkpoint.furthestUnit;
            }
          }}
          onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
          onPause={(event) => { if (!event.currentTarget.ended) void save(event.currentTarget.currentTime); }}
          onEnded={() => void save(lesson.totalUnits)}
          onError={() => { setMedia(null); setMediaState("unavailable"); }}
          aria-label={`Video: ${lesson.title}`}
        >Tu navegador no puede reproducir el video.</video>}
        {media && lesson.kind === "document" && <div className={styles.document}>
          <BookOpen size={30} aria-hidden="true" />
          <h2>Material de lectura</h2>
          <p>El documento se abre en una pestaña separada. Registra la página hasta la que llegaste para retomarla después.</p>
          <a href={media.url} target="_blank" rel="noreferrer" className="button-primary">Abrir documento autorizado <ArrowRight size={17} /></a>
          <form onSubmit={(event) => { event.preventDefault(); void save(documentPage); }} className={styles.pageForm}>
            <label htmlFor="course-last-page">Última página leída</label>
            <input id="course-last-page" type="number" min="1" max={lesson.totalUnits} step="1" value={documentPage}
              onChange={(event) => setDocumentPage(Number(event.target.value))} />
            <button type="submit" disabled={!Number.isInteger(documentPage) || documentPage < 1 || documentPage > lesson.totalUnits} className="button-secondary">
              <Save size={16} /> Guardar página</button>
          </form>
        </div>}
      </section>
      <div className={styles.footnote}>
        <p role="status" aria-live="polite">{checkpointStatus === "saving" ? "Guardando posición…"
          : checkpointStatus === "saved" ? "Tu punto de reanudación está guardado."
          : checkpointStatus === "failed" ? "No se pudo guardar tu punto de reanudación. Vuelve a intentarlo."
          : "Tu posición de lectura o reproducción es independiente de las evaluaciones y certificados."}</p>
        {media && lesson.kind === "video" && <button className="button-secondary" type="button" onClick={() => { if (videoRef.current) void save(videoRef.current.currentTime); }}>
          <Save size={16} /> Guardar posición</button>}
        <Link href="/learn/experiences" className={styles.practiceLink}>Llevarlo a la práctica <ArrowRight size={15} /></Link>
      </div>
    </article>
  );
}
