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
  Lightbulb,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { appendPersistentLearningEvent, fetchPersistentLearningSnapshot, hasPersistentLearningSession } from "@/lib/learning-api-client";
import { readSelectedProgram } from "@/lib/program-selection";
import { moduleThreeSource } from "@/lib/luma-data";
import { firebaseAuth } from "@/lib/firebase-client";
import { guestLearningKeys, pendingLearningKey } from "@/lib/learner-client-storage";
import { evaluatePasSimulation, type SimulationEvidenceReceipt } from "@/lib/simulation-evidence";
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
  const [submitting, setSubmitting] = useState(false);
  const [syncState, setSyncState] = useState<"local" | "synced" | "pending" | "preview">("local");
  const [evidenceReceipt, setEvidenceReceipt] = useState<SimulationEvidenceReceipt | null>(null);
  const current = steps[step];
  const selected = answers[current.id as keyof AnswerState];
  const selectedChoice = choices[current.id as keyof typeof choices].find((item) => item.id === selected);
  const correctCount = useMemo(() => Object.entries(answers).filter(([key, value]) => choices[key as keyof typeof choices].find((item) => item.id === value)?.correct).length, [answers]);

  const choose = (id: string) => {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: id }));
    setAttempted((currentAttempts) => ({ ...currentAttempts, [current.id]: (currentAttempts[current.id] ?? 0) + 1 }));
  };

  const continueSession = async () => {
    if (!selectedChoice?.correct || submitting) return;
    if (step < steps.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }

    setSubmitting(true);
    const eventId = crypto.randomUUID();
    const receipt = evaluatePasSimulation(answers, attempted);
    setEvidenceReceipt(receipt);
    const event = {
      eventId,
      type: "SIMULATION_COMPLETED",
      conceptId: "pas",
      correctCount: receipt.passedCriteria,
      answers,
      attempts: attempted,
      completedAt: new Date().toISOString(),
      sourceId: moduleThreeSource.id,
      rubricId: receipt.rubricId,
      criteria: receipt.criteria,
      evidenceCategory: receipt.evidenceCategory,
      twinAuthority: receipt.twinAuthority,
    };
    const uid = firebaseAuth.currentUser?.uid;
    if (uid && hasPersistentLearningSession()) {
      try {
        // A server-confirmed course is required before queueing any offline
        // retry. Otherwise a later new purchase could inherit this old grade.
        const snapshot = await fetchPersistentLearningSnapshot();
        const selectedProgram = readSelectedProgram("learner", uid);
        if (!snapshot || firebaseAuth.currentUser?.uid !== uid ||
            (selectedProgram && snapshot.program?.programId !== selectedProgram)) {
          setSyncState("preview");
        } else {
          const program = snapshot.program;
          const pendingKey = pendingLearningKey(uid, program);
          window.localStorage.setItem(
            pendingKey,
            JSON.stringify({ ownerUid: uid, program, eventId, event }),
          );
          try {
            const plan = await appendPersistentLearningEvent(
              eventId, event, { uid, program },
            );
            if (plan) {
              window.localStorage.removeItem(pendingKey);
              setSyncState("synced");
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "";
            if (/401|403|409|LEARNER_IDENTITY_CHANGED/.test(message)) {
              window.localStorage.removeItem(pendingKey);
              setSyncState("preview");
            } else {
              setSyncState("pending");
            }
          }
        }
      } catch {
        // No verified scope => no safe pending write, even when offline.
        setSyncState("preview");
      }
    } else {
      window.localStorage.setItem(guestLearningKeys.latestScored, JSON.stringify(event));
      setSyncState("preview");
    }

    setCompleted(true);
    setSubmitting(false);
  };

  const reset = () => {
    setStep(0);
    setAnswers({});
    setAttempted({});
    setCompleted(false);
    setSubmitting(false);
    setSyncState("local");
    setEvidenceReceipt(null);
  };

  if (completed) {
    return (
      <main className={styles.completePage}>
        <div className="page-noise" />
        <section className={`${styles.completeCard} content-surface`}>
          <div className={styles.completeOrb}><Check size={54} /></div>
          <span className="eyebrow"><span className="eyebrow-dot" /> {syncState === "synced" ? "Evidencia registrada" : "Resultado de la práctica de muestra"}</span>
          <h1>{syncState === "synced" ? "Demostraste transferencia." : "Terminaste la práctica de muestra."}</h1>
          <p>Separaste acontecimiento, pensamiento y emoción; luego formulaste una alternativa comprobable. {syncState === "synced"
            ? "Tu expediente incluye esta práctica, con los intentos que necesitaste."
            : "Este resultado no se presenta como avance acreditado hasta que LUMA confirme una matrícula activa y guarde la evidencia."}</p>
          <div className={styles.evidenceReceipt}>
            <div><span>Evento</span><strong>SIMULATION_COMPLETED</strong></div>
            <div><span>Concepto</span><strong>Pensamientos saboteadores</strong></div>
            <div><span>Resultado</span><strong>{evidenceReceipt?.passedCriteria ?? correctCount}/{evidenceReceipt?.totalCriteria ?? 3} criterios</strong></div>
            <div><span>Rúbrica</span><strong>{evidenceReceipt?.rubricId ?? "pas-v1"}</strong></div>
            <div><span>Tipo de evidencia</span><strong>Puntuada</strong></div>
          </div>
          <div className={styles.completeActions}>
            <Link className="button-primary" href="/learn">Volver a mi ruta <ArrowRight size={17} /></Link>
            <button className="button-secondary" type="button" onClick={reset}><RotateCcw size={16} /> Repetir con este caso</button>
          </div>
          <p className={styles.receiptNote}>{syncState === "synced" ? "Evidencia sincronizada con tu perfil persistente. " : syncState === "pending" ? "La evidencia quedó pendiente de sincronización y LUMA volverá a intentarlo al regresar a tu ruta. " : syncState === "preview" ? "Esto es una demostración; no acredita el programa ni se guarda como logro de una matrícula. " : ""}La siguiente comprobación será diferida para confirmar retención y aplicación.</p>
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
            <span className="eyebrow">Actividad pública de muestra · el resultado solo acredita práctica si tu matrícula está activa y LUMA lo confirma.</span>
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
              <button className="button-primary" type="button" disabled={!selectedChoice?.correct} onClick={() => void continueSession()}>{step === 2 ? (submitting ? "Registrando…" : "Registrar evidencia") : "Continuar"} <ArrowRight size={16} /></button>
            </div>
          </section>
        </section>

        <aside className={styles.contextPanel}>
          <section className={`${styles.contextCard} content-surface`}>
            <span className="eyebrow"><BookOpenCheck size={14} /> Fuente activa</span>
            <h2>Pensamientos automáticos saboteadores</h2>
            <p>El material los describe como automáticos, rápidos, rígidos y frecuentemente expresados con absolutos como “siempre”, “jamás” o “imposible”.</p>
            <p>Esta es una síntesis pública de muestra. El material original completo se entrega mediante el acceso autorizado al curso.</p>
          </section>
          <section className={`${styles.twinImpact} content-surface`}>
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
