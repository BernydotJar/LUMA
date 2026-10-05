"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleHelp, RotateCcw, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { getClassContract } from "@/lib/class-contract";
import styles from "./class-entry-diagnostic.module.css";

type ResultState = {
  choiceId: string;
  correct: boolean;
  feedback: string;
  route: "review" | "practice" | "simulation" | "transfer";
};

function appendLearningEvent(event: Record<string, unknown>) {
  const previous = JSON.parse(
    window.localStorage.getItem("luma-learning-events") ?? "[]",
  ) as unknown[];
  window.localStorage.setItem(
    "luma-learning-events",
    JSON.stringify([...previous, event].slice(-30)),
  );
  window.localStorage.setItem("luma-latest-learning-event", JSON.stringify(event));
}

export function ClassEntryDiagnostic({ slug }: { slug: string }) {
  const contract = useMemo(() => getClassContract(slug), [slug]);
  const [selected, setSelected] = useState<string>("");
  const [result, setResult] = useState<ResultState | null>(null);

  if (!contract) return null;

  const selectedChoice = contract.diagnostic.choices.find(
    (choice) => choice.id === selected,
  );

  function checkAnswer() {
    if (!selectedChoice) return;

    const route = selectedChoice.correct
      ? activeContract.diagnostic.correctRoute
      : activeContract.diagnostic.remediationRoute;

    const nextResult: ResultState = {
      choiceId: selectedChoice.id,
      correct: selectedChoice.correct,
      feedback: selectedChoice.feedback,
      route,
    };

    setResult(nextResult);

    appendLearningEvent({
      type: "CLASS_DIAGNOSTIC_COMPLETED",
      classId: activeContract.experienceSlug,
      capabilityId: activeContract.capabilityId,
      sourceIds: activeContract.sourceIds,
      correct: selectedChoice.correct,
      recommendedRoute: route,
      evidenceCategory: "observed",
      twinAuthority: "none",
      completedAt: new Date().toISOString(),
    });
  }

  function reset() {
    setSelected("");
    setResult(null);
  }

  const routeLabel =
    result?.route === "simulation"
      ? "Ir a la simulación"
      : result?.route === "transfer"
        ? "Ir al reto de transferencia"
        : result?.route === "practice"
          ? "Ir a la práctica"
          : "Revisar la idea clave";

  const routeHref =
    result?.route === "review"
      ? "#idea-clave"
      : result?.route === "simulation"
        ? "#practica"
        : "#practica";

  return (
    <section className={styles.section} aria-labelledby="class-contract-title">
      <div className={styles.contract}>
        <span className="eyebrow">
          <Target size={14} /> Contrato de aprendizaje
        </span>
        <h2 id="class-contract-title">Empieza desde donde realmente estás.</h2>
        <div className={styles.contractGrid}>
          <div>
            <span>Al terminar podrás</span>
            <strong>{activeContract.objective}</strong>
          </div>
          <div>
            <span>Cómo lo vas a demostrar</span>
            <strong>{activeContract.evidenceContract.label}</strong>
          </div>
        </div>
      </div>

      <div className={styles.diagnostic}>
        <div className={styles.diagnosticHeading}>
          <span className={styles.number}>01</span>
          <div>
            <span className="eyebrow">
              <CircleHelp size={14} /> Punto de partida
            </span>
            <h3>{activeContract.diagnostic.prompt}</h3>
            <p>
              Es una comprobación breve para elegir dónde empezar. Esta señal no
              certifica dominio.
            </p>
          </div>
        </div>

        <div className={styles.choices}>
          {activeContract.diagnostic.choices.map((choice, index) => (
            <button
              type="button"
              key={choice.id}
              aria-pressed={selected === choice.id}
              data-selected={selected === choice.id || undefined}
              disabled={Boolean(result)}
              onClick={() => setSelected(choice.id)}
            >
              <span>{String.fromCharCode(65 + index)}</span>
              <p>{choice.label}</p>
            </button>
          ))}
        </div>

        {!result ? (
          <div className={styles.actions}>
            <p>
              {selected
                ? "Comprueba tu respuesta para recibir una ruta de entrada."
                : "Elige una opción para continuar."}
            </p>
            <button
              className="button-primary"
              type="button"
              disabled={!selected}
              onClick={checkAnswer}
            >
              Comprobar <ArrowRight size={15} />
            </button>
          </div>
        ) : (
          <div className={styles.result} data-correct={result.correct || undefined}>
            <div className={styles.resultIcon}>
              {result.correct ? <Check size={18} /> : <CircleHelp size={18} />}
            </div>
            <div>
              <strong>
                {result.correct
                  ? "Puedes acelerar esta parte."
                  : "Conviene reforzar una distinción antes de practicar."}
              </strong>
              <p>{result.feedback}</p>
            </div>
            <div className={styles.resultActions}>
              <Link href={routeHref}>
                {routeLabel} <ArrowRight size={15} />
              </Link>
              <button type="button" onClick={reset}>
                <RotateCcw size={14} /> Intentar otra vez
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
