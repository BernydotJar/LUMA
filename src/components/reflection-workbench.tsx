"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  BrainCircuit,
  Check,
  Database,
  ExternalLink,
  FileSearch,
  GitBranch,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Search,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { knowledgeArtifacts } from "@/lib/reflection-data";
import { rankKnowledgeArtifacts } from "@/lib/reflection-engine";
import type {
  KnowledgeArtifact,
  KnowledgeArtifactKind,
  ReflectionExecutionReceipt,
  ReflectionReviewStatus,
  RetrievalIntent,
} from "@/types/reflection";
import styles from "./reflection-workbench.module.css";

type Filter = "all" | KnowledgeArtifactKind;

const kindCopy: Record<KnowledgeArtifactKind, { label: string; short: string }> = {
  "raw-source": { label: "Fuente original", short: "RAW" },
  reflection: { label: "Reflexión derivada", short: "REF" },
  summary: { label: "Síntesis consolidada", short: "SYN" },
  "quality-finding": { label: "Hallazgo de calidad", short: "QA" },
};

const statusCopy: Record<ReflectionReviewStatus, string> = {
  draft: "Borrador",
  "in-review": "En revisión",
  approved: "Aprobado",
  blocked: "Bloqueado",
};

const intentCopy: Record<RetrievalIntent, { label: string; helper: string }> = {
  factual: {
    label: "Factual",
    helper: "La fuente original recibe prioridad sobre cualquier síntesis.",
  },
  conceptual: {
    label: "Conceptual",
    helper: "Puede usar reflexiones aprobadas para conectar ideas sin ocultar las fuentes.",
  },
  "curriculum-review": {
    label: "Revisión",
    helper: "Incluye borradores, vacíos y hallazgos bloqueados para decisión humana.",
  },
};

export function ReflectionWorkbench() {
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>(knowledgeArtifacts);
  const [selectedId, setSelectedId] = useState("reflection-pas-loop");
  const [filter, setFilter] = useState<Filter>("all");
  const [intent, setIntent] = useState<RetrievalIntent>("conceptual");
  const [query, setQuery] = useState("pensamiento emoción intervención");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReflectionExecutionReceipt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selected =
    artifacts.find((artifact) => artifact.id === selectedId) ?? artifacts[0];
  const filteredArtifacts = artifacts.filter(
    (artifact) => filter === "all" || artifact.kind === filter,
  );
  const ranked = useMemo(
    () => rankKnowledgeArtifacts(query, intent, artifacts).slice(0, 4),
    [artifacts, intent, query],
  );

  const generateReflection = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceIds: [
            "raw-emotional-loop",
            "raw-pas",
            "raw-intervention-levels",
          ],
        }),
      });
      const data = (await response.json()) as {
        artifact?: KnowledgeArtifact;
        receipt?: ReflectionExecutionReceipt;
        error?: string;
      };
      if (!response.ok || !data.artifact || !data.receipt) {
        throw new Error(data.error ?? "No fue posible crear la reflexión.");
      }
      setArtifacts((current) => [data.artifact as KnowledgeArtifact, ...current]);
      setSelectedId(data.artifact.id);
      setReceipt(data.receipt);
      setFilter("all");
      setNotice("Actualización preparada. Revisa el contenido y sus fuentes antes de aprobarla.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "La reflexión falló sin afectar la ingesta ni las fuentes.",
      );
    } finally {
      setLoading(false);
    }
  };

  const recordDecision = (
    artifact: KnowledgeArtifact,
    status: Extract<ReflectionReviewStatus, "approved" | "blocked">,
  ) => {
    if (status === "approved" && artifact.highStakes) {
      setNotice("Una afirmación de alto impacto no puede aprobarse sin evidencia externa y revisión cualificada.");
      return;
    }

    const updated = {
      ...artifact,
      status,
      learnerVisible: status === "approved" && !artifact.highStakes,
    };
    setArtifacts((current) =>
      current.map((item) => (item.id === artifact.id ? updated : item)),
    );

    const decision = {
      type:
        status === "approved"
          ? "CURRICULUM_REFLECTION_APPROVED"
          : "CURRICULUM_REFLECTION_BLOCKED",
      artifactId: artifact.id,
      sourceIds: artifact.sourceRefs.map((source) => source.sourceId),
      decidedAt: new Date().toISOString(),
      learnerTwinUpdated: false,
    };
    window.localStorage.setItem(
      "luma-latest-curriculum-decision",
      JSON.stringify(decision),
    );
    setNotice(
      status === "approved"
        ? "Actualización aprobada. Disponible como material de apoyo."
        : "Actualización no aprobada. El contenido publicado permanece sin cambios.",
    );
  };

  return (
    <div className={styles.workbench}>
      <section className={`${styles.hero} content-surface`}>
        <div className={styles.heroCopy}>
          <span className="eyebrow">
            <span className="eyebrow-dot" /> Reflexión de conocimiento
          </span>
          <h2>Mantén el contenido del programa relevante y confiable.</h2>
          <p>
            LUMA detecta conexiones, contradicciones y vacíos entre fuentes; los guarda
            como artefactos derivados, versionados y revisables. La fuente original sigue
            siendo autoridad y ninguna reflexión modifica el gemelo de aprendizaje.
          </p>
          <div className={styles.policyRow} aria-label="Políticas de reflexión">
            <span><Database size={14} /> RAW inmutable</span>
            <span><BadgeCheck size={14} /> Aprobación humana</span>
            <span><LockKeyhole size={14} /> Revisión de contenido</span>
          </div>
        </div>
        <div className={styles.heroAction}>
          <div className={styles.reflectionOrb} aria-hidden="true">
            <GitBranch size={38} />
            <span />
            <span />
            <span />
          </div>
          <button
            className="button-primary"
            type="button"
            onClick={() => void generateReflection()}
            disabled={loading}
          >
            {loading ? <LoaderCircle className={styles.spin} size={17} /> : <WandSparkles size={17} />}
            {loading ? "Reflexionando…" : "Generar reflexión"}
          </button>
          <small>3 fuentes aprobadas · salida en borrador</small>
        </div>
      </section>

      <section className={styles.metricRail} aria-label="Estado de reflexión curricular">
        {[
          [Layers3, "Fuentes activas", "3", "PDF · secciones aprobadas"],
          [Sparkles, "Artefactos derivados", String(artifacts.filter((item) => item.kind !== "raw-source").length), "con linaje completo"],
          [BookOpenCheck, "Listos para retrieval", String(artifacts.filter((item) => item.status === "approved" && item.learnerVisible).length), "por intención"],
          [AlertTriangle, "Afirmaciones bloqueadas", String(artifacts.filter((item) => item.status === "blocked").length), "requieren evidencia"],
        ].map(([Icon, label, value, detail]) => {
          const MetricIcon = Icon as typeof Layers3;
          return (
            <article className="glass-subtle" key={String(label)}>
              <span><MetricIcon size={18} /></span>
              <div><small>{String(label)}</small><strong>{String(value)}</strong><p>{String(detail)}</p></div>
            </article>
          );
        })}
      </section>

      {notice && (
        <section className={styles.notice} role="status">
          <Sparkles size={17} />
          <span>{notice}</span>
          <button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)}><X size={15} /></button>
        </section>
      )}

      <div className={styles.mainGrid}>
        <section className={`${styles.artifactRail} content-surface`}>
          <div className={styles.panelHeading}>
            <div>
              <span className="eyebrow"><FileSearch size={14} /> Artefactos</span>
              <h2>Fuente vs. conocimiento derivado</h2>
            </div>
            <span>{filteredArtifacts.length}</span>
          </div>
          <div className={styles.filters} aria-label="Filtrar artefactos">
            {([
              ["all", "Todo"],
              ["raw-source", "RAW"],
              ["reflection", "Reflexión"],
              ["summary", "Síntesis"],
              ["quality-finding", "QA"],
            ] as const).map(([value, label]) => (
              <button
                type="button"
                key={value}
                data-active={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={styles.artifactList}>
            {filteredArtifacts.map((artifact) => (
              <button
                type="button"
                key={artifact.id}
                data-selected={selected.id === artifact.id}
                data-kind={artifact.kind}
                onClick={() => setSelectedId(artifact.id)}
              >
                <span className={styles.kindBadge}>{kindCopy[artifact.kind].short}</span>
                <div>
                  <strong>{artifact.title}</strong>
                  <small>{kindCopy[artifact.kind].label}</small>
                </div>
                <span className={styles.statusDot} data-status={artifact.status} title={statusCopy[artifact.status]} />
              </button>
            ))}
          </div>
        </section>

        <section className={`${styles.detailPanel} content-surface`} data-kind={selected.kind}>
          <header className={styles.detailHeader}>
            <div>
              <div className={styles.detailMeta}>
                <span data-kind={selected.kind}>{kindCopy[selected.kind].label}</span>
                <span data-status={selected.status}>{statusCopy[selected.status]}</span>
                <span>{Math.round(selected.confidence * 100)}% confianza</span>
              </div>
              <h2>{selected.title}</h2>
              <p>{selected.body}</p>
            </div>
            <div className={styles.trustMark} role="img" aria-label="Linaje verificado">
              {selected.highStakes ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}
            </div>
          </header>

          {(selected.novelty || selected.connection || selected.gap) && (
            <div className={styles.reflectionTriptych}>
              <article>
                <span>01 · Qué agrega</span>
                <p>{selected.novelty ?? "Fuente original: opcional en este caso."}</p>
              </article>
              <article>
                <span>02 · Cómo conecta</span>
                <p>{selected.connection ?? "La relación se conserva en la fuente."}</p>
              </article>
              <article data-gap="true">
                <span>03 · Qué falta</span>
                <p>{selected.gap ?? "Gap declarado: ninguno."}</p>
              </article>
            </div>
          )}

          <section className={styles.lineage}>
            <div className={styles.lineageHeading}>
              <div><GitBranch size={16} /><strong>Linaje inspeccionable</strong></div>
              <span>{selected.sourceRefs.length} referencia(s)</span>
            </div>
            <div className={styles.sourceList}>
              {selected.sourceRefs.map((source, index) => (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  key={`${source.sourceId}-${source.locator}`}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{source.locator}</strong>
                    <p>{source.statement}</p>
                    <small>{source.sourceLabel}</small>
                  </div>
                  <ExternalLink size={14} />
                </a>
              ))}
            </div>
          </section>

          <footer className={styles.detailFooter}>
            <div>
              <span>Revisión</span>
              <strong>{selected.status === "approved" ? "Aprobado" : "Pendiente de decisión"}</strong>
            </div>
            {selected.kind !== "raw-source" && selected.status !== "approved" && (
              <div className={styles.reviewActions}>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => recordDecision(selected, "blocked")}
                >
                  <X size={15} /> Bloquear
                </button>
                <button
                  type="button"
                  className="button-primary"
                  disabled={selected.highStakes}
                  onClick={() => recordDecision(selected, "approved")}
                >
                  <Check size={15} /> Aprobar con recibo
                </button>
              </div>
            )}
            {selected.status === "approved" && selected.kind !== "raw-source" && (
              <span className={styles.approvedReceipt}><BadgeCheck size={15} /> Disponible según intención</span>
            )}
          </footer>

          {receipt?.artifactId === selected.id && (
            <div className={styles.executionReceipt}>
              <BrainCircuit size={17} />
              <div>
                <strong>Resultado de la revisión</strong>
                <p>{receipt.sourceIds.length} fuentes consultadas · Sin cambios automáticos en el progreso del participante</p>
              </div>
            </div>
          )}
        </section>

        <aside className={styles.rightColumn}>
          <section className={`${styles.retrievalLab} content-surface`}>
            <div className={styles.panelHeading}>
              <div><span className="eyebrow"><Search size={14} /> Retrieval lab</span><h2>La intención cambia el ranking</h2></div>
            </div>
            <div className={styles.intentTabs}>
              {(Object.keys(intentCopy) as RetrievalIntent[]).map((item) => (
                <button
                  type="button"
                  key={item}
                  data-active={intent === item}
                  onClick={() => setIntent(item)}
                >
                  {intentCopy[item].label}
                </button>
              ))}
            </div>
            <p className={styles.intentHelper}>{intentCopy[intent].helper}</p>
            <label className={styles.searchBox}>
              <span className="sr-only">Consulta de recuperación</span>
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <div className={styles.results}>
              {ranked.map((artifact, index) => (
                <button type="button" key={artifact.id} onClick={() => setSelectedId(artifact.id)}>
                  <span>{index + 1}</span>
                  <div>
                    <small>{kindCopy[artifact.kind].short} · score {artifact.rankScore.toFixed(2)}</small>
                    <strong>{artifact.title}</strong>
                    <p>{artifact.rankReason}</p>
                  </div>
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </section>

          <section className={`${styles.guardrailCard} content-surface`}>
            <div className={styles.guardrailIcon}><ShieldCheck size={22} /></div>
            <div>
              <span className="eyebrow">Autoridad explícita</span>
              <h2>La reflexión mejora el sistema; el participante demuestra el aprendizaje.</h2>
              <p>Estos artefactos pueden mejorar búsqueda, tutor y revisión curricular. Solo eventos aceptados de interacción actualizan dominio, confianza o recomendaciones.</p>
            </div>
            <ul>
              <li><Check size={14} /> La ingesta termina aunque falle la reflexión</li>
              <li><Check size={14} /> Consolidación solo sobre artefactos aprobados</li>
              <li><Check size={14} /> Afirmaciones sensibles bloqueadas por política</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
