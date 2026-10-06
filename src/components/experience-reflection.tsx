"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, LoaderCircle, RotateCcw, Sparkles, Volume2 } from "lucide-react";
import { synthesizeReflectionGuide } from "@/app/actions/speech";
import type { LearningExperience } from "@/lib/learning-content";
import styles from "./experience-reflection.module.css";

export function ExperienceReflection({ experience }: { experience: LearningExperience }) {
  const [response, setResponse] = useState("");
  const [completed, setCompleted] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const [isAudioPending, startAudioTransition] = useTransition();

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


  const submit = () => {
    const event = {
      type: "PRACTICE_REFLECTION_RECORDED",
      experienceId: experience.id,
      conceptId: experience.id,
      sourceId: experience.sourceId,
      evidenceCategory: "self-reported",
      responseLength: response.trim().length,
      completedAt: new Date().toISOString(),
    };

    window.localStorage.setItem("luma-latest-learning-event", JSON.stringify(event));
    const previous = JSON.parse(window.localStorage.getItem("luma-learning-events") ?? "[]") as unknown[];
    window.localStorage.setItem("luma-learning-events", JSON.stringify([...previous, event].slice(-30)));
    setCompleted(true);
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
        <div className={styles.actions}>
          <Link href="/learn/experiences">Explorar otra práctica <ArrowRight size={15} /></Link>
          <button type="button" onClick={() => setCompleted(false)}><RotateCcw size={14} /> Revisar mi respuesta</button>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.reflection} aria-labelledby="reflection-title">
      <span className="eyebrow"><Sparkles size={14} /> Cierra con evidencia propia</span>
      <h2 id="reflection-title">{experience.reflectionPrompt}</h2>
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
      <textarea
        aria-label="Tu reflexión"
        onChange={(event) => setResponse(event.target.value)}
        placeholder="Escribe una respuesta concreta, con una situación real si puedes."
        rows={7}
        value={response}
      />
      <div className={styles.footer}>
        <p>{response.trim().length < 25 ? "Usa al menos 25 caracteres para dejar una señal útil." : "Tu respuesta está lista para registrarse como práctica."}</p>
        <button className="button-primary" disabled={response.trim().length < 25} onClick={submit} type="button">
          Registrar práctica <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
