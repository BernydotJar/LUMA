"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { synthesizeReflectionGuide } from "@/app/actions/speech";
import type { LearningExperience } from "@/lib/learning-content";
import { useLumaAuth } from "@/components/auth-provider";
import { loadLearnerReflection, saveLearnerReflection } from "@/lib/learning-reflections-client";
import type { StoredLearnerReflection } from "@/lib/learning-store";
import styles from "./experience-reflection.module.css";

const VOICE_ENABLED = process.env.NEXT_PUBLIC_SE_VOICE_ENABLED === "true";

export function ExperienceReflection({ experience }: { experience: LearningExperience }) {
  const { user, loading } = useLumaAuth();
  const [draft, setDraft] = useState<{ uid: string | null; experienceId: string; text: string } | null>(null);
  const [saved, setSaved] = useState<{ uid: string; reflection: StoredLearnerReflection } | null>(null);
  const [guestCompleted, setGuestCompleted] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const response = draft?.uid === (user?.uid ?? null) && draft.experienceId === experience.id
    ? draft.text : "";
  const matched = saved?.uid === user?.uid && saved?.reflection.experienceId === experience.id;
  const completed = !editing && (user ? matched : guestCompleted === experience.id);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const [isAudioPending, startAudioTransition] = useTransition();

  useEffect(() => {
    const uid = user?.uid;
    if (!uid || loading) return;
    let cancelled = false;
    void loadLearnerReflection(experience.id).then((reflection) => {
      if (cancelled) return;
      if (reflection) {
        setSaved({ uid, reflection });
        setDraft({ uid, experienceId: experience.id, text: reflection.response });
      } else {
        setSaved(null);
      }
    }).catch(() => {
      // The response remains an unsaved draft until persistence is available.
    });
    return () => { cancelled = true; };
  }, [loading, user?.uid, experience.id]);

  const listenToGuide = () => {
    setAudioError("");
    startAudioTransition(async () => {
      const result = await synthesizeReflectionGuide(experience.reflectionPrompt);
      if (!result.ok) {
        setAudioSrc(null);
        setAudioError("La guía de audio no está disponible en este momento. Puedes continuar con el texto.");
        return;
      }

      setAudioSrc(result.audioDataUrl);
    });
  };


  const submit = async () => {
    if (submitting || response.trim().length < 25 || loading) return;
    setSaveError("");
    const uid = user?.uid;
    if (!uid) {
      // An anonymous preview is deliberately not a personal academic record.
      setGuestCompleted(experience.id);
      return;
    }
    setSubmitting(true);
    try {
      const reflection = await saveLearnerReflection(experience.id, response.trim());
      if (!reflection) throw new Error("REFLECTION_NOT_SAVED");
      setSaved({ uid, reflection });
      setEditing(false);
    } catch {
      setSaveError("No pudimos guardar tu reflexión en tu expediente. Reintenta para conservarla.");
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <section className={styles.complete} aria-live="polite">
        <div className={styles.completeMark}><Check size={28} /></div>
        <span className="eyebrow"><Sparkles size={14} /> Práctica registrada</span>
        <h2>Ya dejaste una señal útil.</h2>
        <p>
          Esta reflexión registra práctica y contexto. Por sí sola no demuestra dominio; LUMA necesita una señal adicional de aplicación para actualizar esa capacidad.
        </p>
        <div className={styles.receipt}>
          <span>Evento</span><strong>PRACTICE_REFLECTION_RECORDED</strong>
          <span>Capacidad</span><strong>{experience.shortTitle}</strong>
          <span>Evidencia</span><strong>Auto-reportada</strong>
        </div>
        <p role="status">{user ? "Reflexión guardada en tu expediente, disponible al volver a iniciar sesión." : "Vista previa registrada en esta sesión, sin expediente personal."}</p>
        <div className={styles.actions}>
          <Link href="/learn/experiences">Explorar otra práctica <ArrowRight size={15} /></Link>
          <button type="button" onClick={() => { setEditing(true); setGuestCompleted(null); }}><RotateCcw size={14} /> Revisar mi respuesta</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.reflection} aria-labelledby="reflection-title">
      <span className="eyebrow"><Sparkles size={14} /> Cierra con evidencia propia</span>
      <h2 id="reflection-title">{experience.reflectionPrompt}</h2>
      {VOICE_ENABLED && (
        <div className={styles.voiceGuide}>
          <button
            className={styles.listenButton}
            disabled={isAudioPending}
            onClick={listenToGuide}
            type="button"
          >
            {isAudioPending ? <LoaderCircle className={styles.spinner} size={15} /> : <Volume2 size={15} />}
            {isAudioPending ? "Preparando audio…" : audioSrc ? "Generar de nuevo" : "Escuchar guía"}
          </button>
          {audioSrc && (
            <audio
              aria-label="Guía de audio de la reflexión"
              className={styles.audioPlayer}
              controls
              autoPlay
              preload="metadata"
              src={audioSrc}
            />
          )}
          {audioError && <p className={styles.audioError} role="status">{audioError}</p>}
        </div>
      )}
      <textarea
        aria-label="Tu reflexión"
        onChange={(event) => setDraft({ uid: user?.uid ?? null, experienceId: experience.id, text: event.target.value })}
        placeholder="Escribe una respuesta concreta, con una situación real si puedes."
        rows={7}
        value={response}
      />
      {saveError && <p role="alert">{saveError}</p>}
      <div className={styles.footer}>
        <p>{response.trim().length < 25 ? "Usa al menos 25 caracteres para dejar una señal útil." : "Tu respuesta está lista para registrarse como práctica."}</p>
        <button className="button-primary" disabled={response.trim().length < 25 || submitting || loading} onClick={() => void submit()} type="button">
          {submitting ? "Guardando reflexión…" : "Registrar práctica"} <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
