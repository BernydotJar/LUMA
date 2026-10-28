"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, LoaderCircle, RotateCcw } from "lucide-react";
import { captureLearnerRequestScope, learnerProgramHeaders, assertLearnerRequestScope } from "@/lib/learner-program-request";
import { getLearningExperience } from "@/lib/learning-content";
import type { AdaptiveLearningPlan } from "@/lib/learner-projection";
import type { ProgramEntryAssessmentSummary } from "@/lib/program-assessment";
import styles from "./program-entry-assessment.module.css";

type Question = {
  slug: string;
  title: string;
  capability: string;
  prompt: string;
  choices: Array<{ id: string; label: string }>;
};

export function ProgramEntryAssessment({
  summary,
  hasProfile,
  userId,
  programId,
  onPlanUpdate,
}: {
  summary?: ProgramEntryAssessmentSummary;
  hasProfile: boolean;
  userId?: string;
  programId: string | null;
  onPlanUpdate?: (plan: AdaptiveLearningPlan) => void;
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<{ uid: string; programId: string | null; summary: ProgramEntryAssessmentSummary } | null>(null);
  const latest = saved && saved.uid === userId && saved.programId === programId ? saved.summary : summary;

  async function authorizedHeaders(json = false) {
    if (!userId) throw new Error("Inicia sesión para realizar el diagnóstico.");
    const scope = captureLearnerRequestScope(userId, programId);
    return { scope, headers: await learnerProgramHeaders(scope, json) };
  }

  async function begin() {
    setBusy(true);
    setError("");
    try {
      const request = await authorizedHeaders();
      const response = await fetch("/api/learning/entry-assessment", {
        headers: request.headers,
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(response.status === 409
          ? "Primero completa tu perfil de aprendizaje."
          : response.status === 403
            ? "Tu matrícula no permite este diagnóstico todavía."
            : "No pudimos cargar el diagnóstico autorizado.");
      }
      const body = (await response.json()) as { questions: Question[] };
      assertLearnerRequestScope(request.scope);
      if (!Array.isArray(body.questions) || body.questions.length === 0) {
        throw new Error("Las preguntas no están disponibles.");
      }
      setQuestions(body.questions);
      setAnswers({});
      setStep(0);
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos cargar el diagnóstico.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (Object.keys(answers).length !== questions.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const request = await authorizedHeaders(true);
      const response = await fetch("/api/learning/entry-assessment", {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ eventId: crypto.randomUUID(), answers }),
      });
      const body = (await response.json()) as {
        summary?: ProgramEntryAssessmentSummary;
        plan?: AdaptiveLearningPlan;
        error?: string;
      };
      assertLearnerRequestScope(request.scope);
      if (!response.ok || !body.summary || !body.plan) {
        throw new Error(response.status === 429
          ? "Acabas de completar el diagnóstico. Tu resultado anterior sigue disponible."
          : response.status === 409
            ? "Completa primero tu perfil de aprendizaje."
            : "No pudimos guardar tu punto de partida. Tus respuestas siguen aquí.");
      }
      setSaved({ uid: request.scope.uid, programId: request.scope.programId, summary: body.summary });
      onPlanUpdate?.(body.plan);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos completar el diagnóstico.");
    } finally {
      setBusy(false);
    }
  }

  const current = questions[step];
  const recommendation = getLearningExperience(latest?.recommendedSlug ?? "");
  return (
    <section className={styles.surface + " content-surface"} aria-labelledby="entry-assessment-title" data-testid="program-entry-assessment">
      <div className={styles.top}>
        <span className={styles.symbol}><ClipboardCheck size={22} aria-hidden="true" /></span>
        <div className={styles.intro}>
          <span className="eyebrow">PUNTO DE PARTIDA · PROGRAMA</span>
          <h2 id="entry-assessment-title">Una ruta que empieza contigo.</h2>
          <p>Cinco situaciones cortas para orientar tu primera práctica. No es un examen de certificación y no modifica tu nivel de dominio.</p>
        </div>
      </div>

      {!hasProfile ? (
        <Link href="/onboarding" className={styles.action}>Define tu objetivo primero <ArrowRight size={16} /></Link>
      ) : !userId ? (
        <Link href="/login" className={styles.action}>Inicia sesión para guardar tu diagnóstico <ArrowRight size={16} /></Link>
      ) : (
        <>
          {latest && recommendation && !open && (
            <div className={styles.result} role="status" data-testid="entry-assessment-result">
              <CheckCircle2 size={20} aria-hidden="true" />
              <div>
                <strong>Tu punto de partida: {recommendation.shortTitle}</strong>
                <p>{latest.correct} de {latest.total} distinciones reconocidas. La recomendación es orientativa; tu avance se demuestra con práctica.</p>
                <Link href={"/learn/experience/" + recommendation.slug}>
                  Empezar esta experiencia <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          )}

          {!open ? (
            <button className={styles.action} type="button" onClick={() => void begin()} disabled={busy}>
              {busy ? <LoaderCircle size={17} className={styles.spin} /> : latest ? <RotateCcw size={16} /> : <ArrowRight size={16} />}
              {latest ? "Recalibrar mi ruta" : "Descubrir dónde empezar"}
            </button>
          ) : current ? (
            <div className={styles.quiz} data-testid="entry-assessment-quiz">
              <div className={styles.progress}>
                <span>Situación {step + 1} de {questions.length}</span>
                <span>{current.title}</span>
              </div>
              <progress value={step + 1} max={questions.length} aria-label="Progreso del diagnóstico" />
              <fieldset>
                <legend>{current.prompt}</legend>
                <p className={styles.capability}>Capacidad: {current.capability}</p>
                <div className={styles.choices}>
                  {current.choices.map((choice) => (
                    <label key={choice.id} data-selected={answers[current.slug] === choice.id}>
                      <input type="radio" name={current.slug} value={choice.id}
                        checked={answers[current.slug] === choice.id}
                        onChange={() => setAnswers((previous) => ({ ...previous, [current.slug]: choice.id }))}
                      />
                      <span>{choice.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className={styles.controls}>
                <button type="button" onClick={() => setStep((i) => Math.max(0, i - 1))} disabled={busy || step === 0}>Anterior</button>
                {step + 1 === questions.length ? (
                  <button type="button" className={styles.action} onClick={() => void submit()} disabled={!answers[current.slug] || busy}>
                    {busy ? <LoaderCircle size={16} className={styles.spin} /> : <CheckCircle2 size={16} />}
                    Ver mi ruta
                  </button>
                ) : (
                  <button type="button" className={styles.action} onClick={() => setStep((i) => i + 1)} disabled={!answers[current.slug]}>
                    Continuar <ArrowRight size={16} />
                  </button>
                )}
              </div>
            </div>
          ) : null}
          {error && <p className={styles.error} role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
