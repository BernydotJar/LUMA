"use client";

import { FormEvent, useState, useSyncExternalStore } from "react";
import { Mic, Search, Sparkles } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase-client";
import styles from "./content-intelligence-search.module.css";

type SearchHit = {
  chunkId: string;
  sourceId: string;
  module: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  startClock: string;
  endClock: string;
  text: string;
  citation: string;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  onresult?: (event: {
    results: ArrayLike<{
      0: { transcript: string };
    }>;
  }) => void;
  onerror?: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function speechConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const typed = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return typed.SpeechRecognition ?? typed.webkitSpeechRecognition;
}

export function ContentIntelligenceSearch() {
  const [query, setQuery] = useState("¿Qué se explica sobre P.A.S. y emoción?");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");
  const [message, setMessage] = useState("");
  const canDictate = useSyncExternalStore(
    () => () => {},
    () => Boolean(speechConstructor()),
    () => false,
  );

  async function search() {
    const normalized = query.trim();
    if (normalized.length < 2) return;

    const user = firebaseAuth.currentUser;
    if (!user) {
      setStatus("error");
      setMessage("Inicia sesión para consultar el corpus.");
      return;
    }

    setStatus("searching");
    setMessage("");
    try {
      const response = await fetch("/api/content-intelligence/search", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({ query: normalized, limit: 5 }),
      });
      if (!response.ok) {
        throw new Error(`SEARCH_${response.status}`);
      }
      const body = (await response.json()) as { results?: SearchHit[] };
      setResults(Array.isArray(body.results) ? body.results : []);
      setStatus("idle");
      if (!body.results?.length) {
        setMessage("No encontré un segmento suficientemente relevante en el corpus conectado.");
      }
    } catch {
      setStatus("error");
      setMessage("La búsqueda del corpus no está disponible en este momento.");
    }
  }

  function dictate() {
    const Constructor = speechConstructor();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = "es-CO";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) setQuery(transcript);
    };
    recognition.onerror = () => {
      setMessage("No pude capturar la voz. Puedes escribir la pregunta.");
    };
    recognition.start();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void search();
  }

  return (
    <section className={`${styles.searchCard} glass`} aria-labelledby="content-intelligence-search-title">
      <div className={styles.heading}>
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Inteligencia de contenido</span>
          <h2 id="content-intelligence-search-title">Pregunta al conocimiento acumulado.</h2>
          <p>Busca por concepto, historia o pregunta. LUMA devuelve el pasaje recuperado y el minuto exacto de la fuente.</p>
        </div>
        <span className="status-pill" data-tone="positive">Corpus audiovisual</span>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <label htmlFor="content-query">¿Qué quieres encontrar?</label>
        <div>
          <input
            id="content-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={500}
            placeholder="Ej. ¿Qué dice el material sobre P.A.S.?"
          />
          <button
            type="button"
            className={styles.voiceButton}
            onClick={dictate}
            disabled={!canDictate}
            aria-label="Dictar pregunta"
            title={canDictate ? "Dictar pregunta" : "Dictado no disponible en este navegador"}
          >
            <Mic size={17} />
          </button>
          <button type="submit" className="button-primary" disabled={status === "searching"}>
            <Search size={17} />
            {status === "searching" ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </form>

      {message ? <p className={styles.message}>{message}</p> : null}

      {results.length > 0 ? (
        <div className={styles.results}>
          {results.map((hit) => (
            <article className="glass-subtle" key={hit.chunkId}>
              <div className={styles.resultMeta}>
                <span>{hit.module}</span>
                <strong>{hit.startClock} → {hit.endClock}</strong>
              </div>
              <h3>{hit.title}</h3>
              <p>{hit.text}</p>
              <small>{hit.citation}</small>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
