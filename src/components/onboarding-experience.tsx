"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Compass,
  Gauge,
  HeartHandshake,
  Sparkles,
  Target,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { bootstrapPersistentLearningPlan } from "@/lib/learning-api-client";
import { createAdaptiveLearningPlan } from "@/lib/learner-projection";
import styles from "./onboarding-experience.module.css";

const goals = [
  { id: "emotions", icon: HeartHandshake, title: "Gestionar mejor mis emociones", copy: "Reconocer patrones y responder con más intención." },
  { id: "beliefs", icon: Sparkles, title: "Transformar creencias que me frenan", copy: "Identificar filtros, probar alternativas y transferirlas." },
  { id: "communication", icon: Compass, title: "Comunicarme con más claridad", copy: "Comprender estados, intención y efectos en otras personas." },
];

const timeOptions = [8, 12, 20, 35];

export function OnboardingExperience() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("beliefs");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(2);
  const [minutes, setMinutes] = useState(12);
  const [saving, setSaving] = useState(false);

  const selectedGoal = useMemo(() => goals.find((item) => item.id === goal) ?? goals[1], [goal]);
  const canContinue = step !== 1 || diagnostic !== null;
  const previewPlan = useMemo(
    () =>
      createAdaptiveLearningPlan({
        goal,
        diagnostic,
        confidence,
        minutes,
        createdAt: "preview",
      }),
    [goal, diagnostic, confidence, minutes],
  );

  const finish = async () => {
    setSaving(true);
    const state = { goal, diagnostic, confidence, minutes, createdAt: new Date().toISOString() };
    window.localStorage.setItem("luma-onboarding", JSON.stringify(state));
    window.localStorage.removeItem("luma-latest-learning-event");
    window.localStorage.removeItem("luma-pending-learning-event");

    try {
      await bootstrapPersistentLearningPlan(state);
    } catch {
      // Guest mode and temporary persistence failures continue with the deterministic local projection.
    } finally {
      router.push("/learn");
    }
  };

  return (
    <main className={styles.page}>
      <div className="page-noise" />
      <header className={styles.header}>
        <BrandMark />
        <span>Preparando tu experiencia</span>
        <button type="button" onClick={() => router.push("/learn")}>Usar perfil de showcase</button>
      </header>

      <div className={styles.layout}>
        <aside className={`${styles.context} glass`}>
          <span className="eyebrow"><span className="eyebrow-dot" /> Antes de empezar</span>
          <h1>LUMA empieza con lo esencial sobre tu objetivo.</h1>
          <p>Con unas pocas señales iniciales construye una ruta que se ajusta a lo que quieres lograr. Puedes actualizar tu perfil de aprendizaje en cualquier momento.</p>
          <div className={styles.twinPreview}>
            <div className={styles.previewOrb}><Sparkles size={40} /></div>
            <div>
              <span>Perfil de aprendizaje</span>
              <strong>{Math.round(((step + 1) / 4) * 100)}% preparado</strong>
              <div><span style={{ width: `${((step + 1) / 4) * 100}%` }} /></div>
            </div>
          </div>
          <ul>
            <li><Check size={15} /> Personalización basada en tu actividad de aprendizaje</li>
            <li><Check size={15} /> Perfil editable en cualquier momento</li>
            <li><Check size={15} /> Señales relevantes para tu objetivo</li>
          </ul>
        </aside>

        <section className={styles.formArea}>
          <div className={styles.stepper} aria-label={`Paso ${step + 1} de 4`}>
            {[0, 1, 2, 3].map((item) => <span key={item} data-active={item <= step} />)}
            <small>Paso {step + 1} de 4</small>
          </div>

          {step === 0 && (
            <div className={styles.stepContent}>
              <span className="eyebrow"><Target size={14} /> Tu dirección</span>
              <h2>¿Qué quieres ser capaz de hacer?</h2>
              <p>Elige la capacidad que quieres fortalecer ahora. Esta meta guía las prácticas que LUMA selecciona para ti.</p>
              <div className={styles.goalGrid}>
                {goals.map(({ id, icon: Icon, title, copy }) => (
                  <button type="button" key={id} data-selected={goal === id} onClick={() => setGoal(id)}>
                    <span><Icon size={22} /></span>
                    <strong>{title}</strong>
                    <p>{copy}</p>
                    <i>{goal === id && <Check size={14} />}</i>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className={styles.stepContent}>
              <span className="eyebrow"><Gauge size={14} /> Diagnóstico breve</span>
              <h2>Vamos a comprobar lo que ya puedes aplicar.</h2>
              <p>Elige la respuesta que mejor representa un pensamiento automático saboteador.</p>
              <div className={styles.questionCard}>
                <strong>Situación: recibes una observación crítica en una reunión.</strong>
                {[
                  ["a", "“La observación se refiere a esta entrega; voy a pedir un ejemplo.”"],
                  ["b", "“Siempre arruino todo. Jamás voy a estar al nivel.”"],
                  ["c", "“Siento incomodidad y necesito unos segundos antes de responder.”"],
                ].map(([id, label]) => (
                  <button type="button" key={id} data-selected={diagnostic === id} onClick={() => setDiagnostic(id)}>
                    <span>{id.toUpperCase()}</span>{label}{diagnostic === id && <Check size={16} />}
                  </button>
                ))}
              </div>
              <div className={styles.confidence}>
                <div><strong>¿Qué tan seguro estás?</strong><span>{confidence}/5</span></div>
                <input aria-label="Confianza" type="range" min="1" max="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} />
                <div><small>Explorando</small><small>Muy seguro</small></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepContent}>
              <span className="eyebrow"><Clock3 size={14} /> Tu contexto real</span>
              <h2>¿Cuánto tiempo tienes en una sesión normal?</h2>
              <p>Tu tiempo disponible define la práctica más útil para esta sesión.</p>
              <div className={styles.timeGrid}>
                {timeOptions.map((option) => (
                  <button type="button" key={option} data-selected={minutes === option} onClick={() => setMinutes(option)}>
                    <strong>{option}</strong><span>minutos</span>{minutes === option && <Check size={15} />}
                  </button>
                ))}
              </div>
              <div className={`${styles.contextCallout} glass-subtle`}>
                <Sparkles size={21} />
                <div><strong>Con {minutes} minutos, LUMA priorizará</strong><p>{minutes <= 12 ? "micro-prácticas, recuperación activa y segmentos precisos." : "práctica guiada, simulación y reflexión con evidencia."}</p></div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={styles.stepContent}>
              <span className="eyebrow"><Sparkles size={14} /> Tu punto de partida</span>
              <h2>Tu punto de partida está listo.</h2>
              <p>Este perfil evoluciona con tus acciones, resultados y nuevas metas.</p>
              <div className={`${styles.summaryCard} glass`}>
                <div><span>Objetivo</span><strong>{selectedGoal.title}</strong></div>
                <div><span>Señal diagnóstica</span><strong>{diagnostic === "b" ? "Reconocimiento correcto" : "Práctica recomendada"}</strong></div>
                <div><span>Confianza reportada</span><strong>{confidence}/5</strong></div>
                <div><span>Formato recomendado</span><strong>Sesiones de {minutes} min</strong></div>
                <div className={styles.firstAction}><Sparkles size={18} /><span><small>Primera acción sugerida</small><strong>{previewPlan.nextAction.title}</strong></span></div>
              </div>
            </div>
          )}

          <footer className={styles.formFooter}>
            <button className="button-ghost" type="button" onClick={() => step === 0 ? router.push("/") : setStep((current) => current - 1)}>
              <ArrowLeft size={17} /> {step === 0 ? "Volver" : "Anterior"}
            </button>
            {step < 3 ? (
              <button className="button-primary" type="button" disabled={!canContinue} onClick={() => setStep((current) => current + 1)}>
                Continuar <ArrowRight size={17} />
              </button>
            ) : (
              <button className="button-primary" type="button" disabled={saving} onClick={() => void finish()}>
                {saving ? "Preparando mi ruta…" : "Entrar a mi experiencia"} <ArrowRight size={17} />
              </button>
            )}
          </footer>
        </section>
      </div>
    </main>
  );
}
