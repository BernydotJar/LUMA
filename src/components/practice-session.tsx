"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleHelp,
  Clock3,
  ExternalLink,
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { moduleThreeSource } from "@/lib/luma-data";
import styles from "./practice-session.module.css";

type AnswerState = {
  thought?: string;
  emotion?: string;
  reframe?: string;
};

const steps = [
  { id: "thought", label: "Detecta el pensamiento" },
  { id: "emotion", label: "Conecta la emoción" },
  { id: "reframe", label: "Prueba una alternativa" },
];

const choices = {
  thought: [
    { id: "specific", label: "“La directora señaló dos errores en la entrega.”", correct: false, feedback: "Eso describe el acontecimiento observable. Falta el significado automático que apareció en la mente." },
    { id: "pas", label: "“Siempre arruino todo; seguro ya perdieron la confianza en mí.”", correct: true, feedback: "Correcto. Usa absolutos, generaliza un evento y anticipa una consecuencia sin evidencia suficiente." },
    { id: "emotion", label: "“Siento vergüenza y quiero desaparecer.”", correct: false, feedback: "Eso mezcla emoción e impulso. Pregunta: ¿qué pensamiento hizo que esa emoción tuviera sentido?" },
  ],
  emotion: [
    { id: "anger", label: "Ira, porque la directora fue injusta", correct: false, feedback: "Podría existir ira, pero el pensamiento elegido apunta primero a amenaza de pertenencia y valoración." },
    { id: "shame", label: "Vergüenza y miedo a perder credibilidad", correct: true, feedback: "Buena conexión: el pensamiento interpreta el error como prueba de incapacidad y amenaza la pertenencia." },
    { id: "calm", label: "Calma, porque puedo corregirlo", correct: false, feedback: "Esa sería una posible respuesta después de reformular; todavía no describe el estado automático." },
  ],
  reframe: [
    { id: "positive", label: "“Todo saldrá perfecto; no pasa nada.”", correct: false, feedback: "Cambia un absoluto negativo por uno positivo, pero no incorpora evidencia ni una acción comprobable." },
    { id: "defensive", label: "“El problema fue que no me dieron suficiente tiempo.”", correct: false, feedback: "Podría haber contexto real, pero esta formulación evita examinar qué sí está bajo tu control." },
    { id: "balanced", label: "“Esta entrega tuvo dos errores concretos. Puedo pedir ejemplos, corregirlos y observar si el patrón se repite.”", correct: true, feedback: "La alternativa distingue el evento de la identidad y propone una acción que genera evidencia nueva." },
  ],
};

export function PracticeSession() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [attempted, setAttempted] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState(false);
  const current = steps[step];
  const selected = answers[current.id as keyof AnswerState];
  const selectedChoice = choices[current.id as keyof typeof choices].find((item) => item.id === selected);
  const correctCount = useMemo(() => Object.entries(answers).filter(([key, value]) => choices[key as keyof typeof choices].find((item) => item.id === value)?.correct).length, [answers]);

  const choose = (id: string) => {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: id }));
    setAttempted((currentAttempts) => ({ ...currentAttempts, [current.id]: (currentAttempts[current.id] ?? 0) + 1 }));
  };

  const continueSession = () => {
    if (!selectedChoice?.correct) return;
    if (step < steps.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }
    const event = {
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      correctCount,
      attempts: attempted,
      completedAt: new Date().toISOString(),
      sourceId: moduleThreeSource.id,
    };
    window.localStorage.setItem("luma-latest-learning-event", JSON.stringify(event));
    setCompleted(true);
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setAttempted({});
    setCompleted(false);
  };

  if (completed) {
    return (
      <main className={styles.completePage}>
        <div className="page-noise" />
        <section className={`${styles.completeCard} glass`}>
          <div className={styles.completeOrb}><Check size={54} /></div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Evidencia registrada</span>
          <h1>Demostraste transferencia.</h1>
          <p>Separaste acontecimiento, pensamiento y emoción; luego formulaste una alternativa comprobable. LUMA usará esta señal para ajustar tu progreso de aplicación.</p>
          <div className={styles.evidenceReceipt}>
            <div><span>Evento</span><strong>SIMULATION_COMPLETED</strong></div>
            <div><span>Concepto</span><strong>Pensamientos saboteadores</strong></div>
            <div><span>Resultado</span><strong>3/3 con evidencia</strong></div>
            <div><span>Impacto estimado</span><strong>Aplicación +8</strong></div>
          </div>
          <div className={styles.completeActions}>
            <Link className="button-primary" href="/learn">Volver a mi ruta <ArrowRight size={17} /></Link>
            <button className="button-secondary" type="button" onClick={reset}><RotateCcw size={16} /> Repetir con este caso</button>
          </div>
          <p className={styles.receiptNote}>La siguiente comprobación será diferida para confirmar retención y aplicación.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className="page-noise" />
      <header className={styles.header}>
        <Link href="/learn"><ArrowLeft size={17} /> Salir de la práctica</Link>
        <div><span><Clock3 size={14} /> 12 min</span><span>Práctica 1 de 1</span></div>
      </header>

      <div className={styles.layout}>
        <section className={styles.session}>
          <div className={styles.progress}>
            {steps.map((item, index) => (
              <div key={item.id} data-status={index < step ? "complete" : index === step ? "current" : "upcoming"}>
                <span>{index < step ? <Check size={14} /> : index + 1}</span>
                <strong>{item.label}</strong>
              </div>
            ))}
          </div>

          <div className={styles.scenario}>
            <span className="eyebrow"><Target size={14} /> Caso de práctica</span>
            <h1>La entrega con dos errores</h1>
            <p>En una reunión, la directora muestra dos errores de una propuesta que preparaste. Dice: “Necesitamos revisar con más cuidado antes de compartir esto con el cliente”. Sientes calor en el rostro y dejas de participar.</p>
          </div>

          <section className={styles.question}>
            <div className={styles.questionHeading}>
              <span>{step + 1}</span>
              <div>
                <small>{current.label}</small>
                <h2>{step === 0 ? "¿Cuál es el pensamiento automático?" : step === 1 ? "¿Qué emoción encaja mejor con ese pensamiento?" : "¿Qué alternativa conserva la evidencia sin convertirla en identidad?"}</h2>
              </div>
            </div>
            <div className={styles.choices}>
              {choices[current.id as keyof typeof choices].map((choice) => (
                <button type="button" key={choice.id} data-selected={selected === choice.id} data-correct={selected === choice.id ? choice.correct : undefined} onClick={() => choose(choice.id)}>
                  <span>{selected === choice.id && choice.correct ? <Check size={16} /> : String.fromCharCode(65 + choices[current.id as keyof typeof choices].indexOf(choice))}</span>
                  <p>{choice.label}</p>
                </button>
              ))}
            </div>
            {selectedChoice && (
              <div className={styles.feedback} data-correct={selectedChoice.correct}>
                {selectedChoice.correct ? <Sparkles size={18} /> : <Lightbulb size={18} />}
                <div><strong>{selectedChoice.correct ? "Evidencia útil" : "Pista útil"}</strong><p>{selectedChoice.feedback}</p></div>
              </div>
            )}
            <div className={styles.questionFooter}>
              <button className="button-ghost" type="button" disabled={step === 0} onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))}><ArrowLeft size={16} /> Anterior</button>
              <button className="button-primary" type="button" disabled={!selectedChoice?.correct} onClick={continueSession}>{step === 2 ? "Registrar evidencia" : "Continuar"} <ArrowRight size={16} /></button>
            </div>
          </section>
        </section>

        <aside className={styles.contextPanel}>
          <section className={`${styles.contextCard} glass`}>
            <span className="eyebrow"><BookOpenCheck size={14} /> Fuente activa</span>
            <h2>Pensamientos automáticos saboteadores</h2>
            <p>El material los describe como automáticos, rápidos, rígidos y frecuentemente expresados con absolutos como “siempre”, “jamás” o “imposible”.</p>
            <a href={moduleThreeSource.url} target="_blank" rel="noreferrer">Abrir material original <ExternalLink size={13} /></a>
          </section>
          <section className={`${styles.twinImpact} glass`}>
            <span className="eyebrow"><Sparkles size={14} /> Tu práctica fortalece</span>
            <ul>
              <li><CircleHelp size={15} /><span><strong>Distinción</strong> Acontecimiento vs. interpretación</span></li>
              <li><CircleHelp size={15} /><span><strong>Transferencia</strong> Aplicar el concepto a un caso nuevo</span></li>
              <li><CircleHelp size={15} /><span><strong>Autonomía</strong> Resolver con autonomía</span></li>
            </ul>
            <p>Tu progreso se basa en cómo aplicas el concepto a situaciones concretas.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
