"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  Download,
  Eye,
  Gauge,
  Info,
  Pencil,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { twinDimensions } from "@/lib/luma-data";
import type { EvidenceCategory, TwinDimension } from "@/types/learning";
import { ProgressRing } from "@/components/progress-ring";
import styles from "./twin-detail.module.css";

const categoryCopy: Record<EvidenceCategory, { label: string; description: string }> = {
  observed: {
    label: "Observado",
    description: "Hechos derivados de una interacción o resultado verificable.",
  },
  inferred: {
    label: "Inferido",
    description: "Hipótesis de LUMA con confianza y procedencia explícitas.",
  },
  "self-reported": {
    label: "Auto-reportado",
    description: "Información compartida directamente por la persona.",
  },
};

const bandLabel: Record<TwinDimension["band"], string> = {
  strong: "Fuerte",
  developing: "En desarrollo",
  "needs-attention": "Foco",
};

export function TwinDetail() {
  const [selectedId, setSelectedId] = useState(twinDimensions[1].id);
  const [filter, setFilter] = useState<EvidenceCategory | "all">("all");
  const [coachNote, setCoachNote] = useState(false);
  const selected = useMemo(
    () => twinDimensions.find((item) => item.id === selectedId) ?? twinDimensions[0],
    [selectedId],
  );
  const evidence = selected.evidence.filter(
    (item) => filter === "all" || item.category === filter,
  );
  const average = Math.round(
    twinDimensions.reduce((total, item) => total + item.score, 0) / twinDimensions.length,
  );

  const exportTwin = () => {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        learner: "Mariana",
        dimensions: twinDimensions,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "luma-learning-twin-mariana.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.layout}>
      <section className={`${styles.heroCard} content-surface`}>
        <div className={styles.heroCopy}>
          <span className="eyebrow"><span className="eyebrow-dot" /> LUMA Gemelo de aprendizaje · Inteligencia del entrenador</span>
          <h2>Mariana: estado de aprendizaje con evidencia y confianza.</h2>
          <p>
            El modelo conecta señales observadas, auto-reporte e inferencias acotadas
            para orientar la próxima intervención del entrenador. Cada inferencia conserva
            procedencia y nivel de confianza.
          </p>
          <div className={styles.proprietary}>
            <ShieldCheck size={15} />
            <span>© 2026 LUMA · Modelo de gemelo de aprendizaje y marco de evidencia · Vista interna del entrenador.</span>
          </div>
          <div className={styles.heroActions}>
            <button className="button-secondary" type="button" onClick={exportTwin}>
              <Download size={16} /> Exportar evidencia
            </button>
            <button className="button-ghost" type="button" onClick={() => setCoachNote((value) => !value)}>
              <Pencil size={16} /> {coachNote ? "Nota del entrenador registrada" : "Agregar nota del entrenador"}
            </button>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.orbit}><BrainCircuit size={47} /><span /></div>
          <ProgressRing value={average} size={122} stroke={9} label="señal global" />
        </div>
      </section>

      {coachNote && (
        <section className={styles.correctionBanner}>
          <Check size={18} />
          <div>
            <strong>Nota del entrenador añadida como señal humana.</strong>
            <p>La próxima actualización conservará esta nota junto con evidencia observada e inferencias.</p>
          </div>
        </section>
      )}

      <section className={styles.dimensionGrid} aria-label="Dimensiones del gemelo de aprendizaje">
        {twinDimensions.map((dimension) => (
          <button
            type="button"
            key={dimension.id}
            data-selected={selectedId === dimension.id}
            onClick={() => setSelectedId(dimension.id)}
          >
            <span>{dimension.label}</span>
            <strong>{dimension.score}</strong>
            <div><i style={{ width: `${dimension.score}%` }} /></div>
            <small data-band={dimension.band}>
              {bandLabel[dimension.band]} · {dimension.delta > 0 ? "+" : ""}{dimension.delta}
            </small>
          </button>
        ))}
      </section>

      <div className={styles.detailGrid}>
        <section className={`${styles.evidencePanel} content-surface`}>
          <div className={styles.panelHeading}>
            <div>
              <span className="eyebrow"><Eye size={14} /> Evidencia del participante</span>
              <h2>{selected.label}</h2>
              <p>{selected.summary}</p>
            </div>
            <span
              className="status-pill"
              data-tone={selected.band === "needs-attention" ? "warning" : "positive"}
            >
              {bandLabel[selected.band]}
            </span>
          </div>

          <div className={styles.filters}>
            <button type="button" data-active={filter === "all"} onClick={() => setFilter("all")}>Todo</button>
            {(Object.keys(categoryCopy) as EvidenceCategory[]).map((category) => (
              <button
                type="button"
                key={category}
                data-active={filter === category}
                onClick={() => setFilter(category)}
              >
                {categoryCopy[category].label}
              </button>
            ))}
          </div>

          <div className={styles.evidenceList}>
            {evidence.map((item) => (
              <article key={item.id} data-category={item.category}>
                <span className={styles.evidenceIcon}>
                  {item.category === "observed" ? (
                    <Eye size={17} />
                  ) : item.category === "inferred" ? (
                    <Sparkles size={17} />
                  ) : (
                    <Pencil size={17} />
                  )}
                </span>
                <div>
                  <div>
                    <strong>{categoryCopy[item.category].label}</strong>
                    <span>{Math.round(item.confidence * 100)}% confianza</span>
                  </div>
                  <p>{item.statement}</p>
                  <small>{item.source}</small>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.categoryLegend}>
            {(Object.keys(categoryCopy) as EvidenceCategory[]).map((category) => (
              <div key={category}>
                <strong>{categoryCopy[category].label}</strong>
                <p>{categoryCopy[category].description}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={`${styles.projectionCard} content-surface`}>
            <span className="eyebrow"><Gauge size={14} /> Escenario de aprendizaje</span>
            <h2>Trayectoria estimada con 20 min/día</h2>
            <div className={styles.projectionChart} aria-label="Proyección de dominio para cuatro semanas">
              {[42, 52, 67, 76, 84].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }}>
                  <i>{index === 0 ? "Hoy" : `S${index}`}</i>
                </span>
              ))}
            </div>
            <p>Con la evidencia actual, la competencia de creencias proyecta una señal fuerte en 3–4 semanas.</p>
            <div className={styles.assumption}>
              <Info size={14} />
              <span>Escenario basado en 4 sesiones por semana y mejora sostenida de transferencia.</span>
            </div>
            <button className="button-secondary" type="button">
              Comparar otro escenario <ArrowRight size={16} />
            </button>
          </section>

          <section className={`${styles.privacyCard} content-surface`}>
            <span className={styles.privacyIcon}><ShieldCheck size={22} /></span>
            <div>
              <h2>Gobernanza del modelo</h2>
              <p>El gemelo de aprendizaje conserva separación entre hechos, inferencias y aportes humanos.</p>
            </div>
            <ul>
              <li><Check size={14} /> Alcance: decisiones de aprendizaje</li>
              <li><Check size={14} /> Procedencia por evento y fuente</li>
              <li><Check size={14} /> Revisión humana disponible</li>
            </ul>
            <small className={styles.copyright}>© 2026 LUMA · Inteligencia interna de acompañamiento.</small>
          </section>
        </aside>
      </div>
    </div>
  );
}
