"use client";

import { FormEvent, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  BookOpenCheck,
  Bot,
  ExternalLink,
  GitBranch,
  LoaderCircle,
  Sparkles,
} from "lucide-react";
import { tutorQuickPrompts } from "@/lib/luma-data";
import styles from "./learner-components.module.css";

type TutorMessage = {
  role: "learner" | "tutor";
  content: string;
  evidence?: {
    concept: string;
    source: string;
    url: string;
    confidence: number;
  };
  reflection?: {
    artifactId: string;
    label: string;
    insight: string;
    sourceCount: number;
  };
  trust?: {
    status: "GROUNDED" | "BLOCKED_CLAIM";
    reason?: string;
    artifactId?: string;
  };
};

export function TutorPanel() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      role: "tutor",
      content:
        "Estoy contigo en esta parte del journey. Puedo explicarlo distinto, darte un ejemplo, probarte o llevarte al momento exacto del material. ¿Qué necesitas?",
    },
  ]);

  const sendMessage = async (text: string) => {
    const clean = text.trim();
    if (!clean || loading) return;

    setMessages((current) => [...current, { role: "learner", content: clean }]);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean }),
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
        evidence?: TutorMessage["evidence"];
        reflection?: TutorMessage["reflection"];
        trust?: TutorMessage["trust"];
      };
      setMessages((current) => [
        ...current,
        {
          role: "tutor",
          content:
            data.answer ??
            data.error ??
            "No pude responder con suficiente evidencia.",
          evidence: data.evidence,
          reflection: data.reflection,
          trust: data.trust,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "tutor",
          content:
            "Perdí conexión por un momento. Tu pregunta sigue aquí; vuelve a enviarla cuando estés listo.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(message);
  };

  return (
    <section
      className={`${styles.tutorPanel} glass`}
      aria-labelledby="tutor-title"
    >
      <div className={styles.tutorHeader}>
        <div className={styles.tutorIdentity}>
          <span><Bot size={20} /></span>
          <div>
            <h2 id="tutor-title">Pregunta a LUMA</h2>
            <p>Tu contexto de aprendizaje, aquí mismo</p>
          </div>
        </div>
        <span className="status-pill" data-tone="positive">
          <span className={styles.liveDot} /> Lista
        </span>
      </div>
      <div className={styles.chat} aria-live="polite">
        {messages.slice(-4).map((item, index) => (
          <div
            className={styles.message}
            data-role={item.role}
            key={`${item.role}-${index}-${item.content.slice(0, 12)}`}
          >
            {item.role === "tutor" && (
              <span className={styles.messageAvatar}><Sparkles size={13} /></span>
            )}
            <div>
              <p>{item.content}</p>
              {item.trust?.status === "BLOCKED_CLAIM" && (
                <div className={styles.trustWarning}>
                  <AlertTriangle size={14} />
                  <div>
                    <strong>Claim bloqueado por política</strong>
                    <span>{item.trust.reason}</span>
                  </div>
                </div>
              )}
              {item.evidence && (
                <a
                  className={styles.evidenceChip}
                  href={item.evidence.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpenCheck size={13} />
                  {item.evidence.source} · {Math.round(item.evidence.confidence * 100)}%
                  <ExternalLink size={11} />
                </a>
              )}
              {item.reflection && (
                <div
                  className={styles.reflectionInsight}
                  data-review={item.reflection.label.toLocaleLowerCase("es").includes("pendiente")}
                >
                  <GitBranch size={14} />
                  <div>
                    <strong>{item.reflection.label}</strong>
                    <span>{item.reflection.insight}</span>
                    <small>{item.reflection.sourceCount} fuentes · {item.reflection.artifactId}</small>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className={styles.typing}>
            <LoaderCircle size={15} className={styles.spin} />
            Buscando la mejor ayuda para este momento…
          </div>
        )}
      </div>
      <div className={styles.quickPrompts}>
        {tutorQuickPrompts.map((prompt) => (
          <button
            type="button"
            key={prompt}
            onClick={() => void sendMessage(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
      <form className={styles.tutorComposer} onSubmit={submit}>
        <label className="sr-only" htmlFor="tutor-message">
          Pregunta a LUMA
        </label>
        <input
          id="tutor-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Explícamelo distinto, ponme a prueba…"
          autoComplete="off"
        />
        <button
          type="submit"
          aria-label="Enviar pregunta"
          disabled={!message.trim() || loading}
        >
          <ArrowUp size={18} />
        </button>
      </form>
      <p className={styles.tutorDisclaimer}>
        Las respuestas importantes muestran su fuente. Tu progreso cambia sólo cuando aparece evidencia.
      </p>
    </section>
  );
}
