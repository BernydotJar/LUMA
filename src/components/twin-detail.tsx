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
  observed: { label: "Observado", description: "Hechos derivados de una interacción o resultado verificable." },
  inferred: { label: "Inferido", description: "Hipótesis de LUMA con confianza y procedencia explícitas." },
  "self-reported": { label: "Auto-reportado", description: "Información que tú decidiste compartir directamente." },
};

const bandLabel: Record<TwinDimension["band"], string> = {
  strong: "Fuerte",
  developing: "En desarrollo",
  "needs-attention": "Necesita atención",
};

export function TwinDetail() {
  const [selectedId, setSelectedId] = useState(twinDimensions[1].id);
  const [filter, setFilter] = useState<EvidenceCategory | "all">("all");
  const [corrected, setCorrected] = useState(false);
  const selected = useMemo(() => twinDimensions.find((item) => item.id === selectedId) ?? twinDimensions[0], [selectedId]);
  const evidence = selected.evidence.filter((item) => filter === "all" || item.category === filter);
  const average = Math.round(twinDimensions.reduce((total, item) => total + item.score, 0) / twinDimensions.length);

  const exportTwin = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), dimensions: twinDimensions }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "luma-learning-twin.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.layout}>
      <section className={`${styles.heroCard} glass`}>
        <div className={styles.heroCopy}>
          <span className="eyebrow"><span className="eyebrow-dot" /> Estado actual</span>
          <h2>Tu Learning Twin es una explicación viva, no una etiqueta.</h2>
          <p>LUMA actualiza este mapa cuando observa evidencia nueva. Las inferencias nunca se mezclan silenciosamente con los hechos.</p>
          <div className={styles.heroActions}>
            <button className="button-secondary" type="button" onClick={exportTwin}><Download size={16} /> Exportar mis datos</button>
            <button className="button-ghost" type="button" onClick={() => setCorrected((value) => !value)}><Pencil size={16} /> {corrected ? "Corrección registrada" : "Corregir una inferencia"}</button>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.orbit}><BrainCircuit size={47} /><span /></div>
          <ProgressRing value={average} size={122} stroke={9} label="señal global" />
        </div>
      </section>

      {corrected && (
        <section className={styles.correctionBanner}>
          <Check size={18} />
          <div><strong>Tu corrección quedó registrada como auto-reportada.</strong><p>No reemplaza la evidencia observada; convivirá con ella y LUMA buscará confirmación en futuras interacciones.</p></div>
        </section>
      )}

      <section className={styles.dimensionGrid} aria-label="Dimensiones del Learning Twin">
        {twinDimensions.map((dimension) => (
          <button type="button" key={dimension.id} data-selected={selectedId === dimension.id} onClick={() => setSelectedId(dimension.id)}>
            <span>{dimension.label}</span>
            <strong>{dimension.score}</strong>
            <div><i style={{ width: `${dimension.score}%` }} /></div>
            <small data-band={dimension.band}>{bandLabel[dimension.band]} · {dimension.delta > 0 ? "+" : ""}{dimension.delta}</small>
          </button>
        ))}
      </section>

      <div className={styles.detailGrid}>
        <section className={`${styles.evidencePanel} glass`}>
          <div className={styles.panelHeading}>
            <div>
              <span className="eyebrow"><Eye size={14} /> Evidencia inspeccionable</span>
              <h2>{selected.label}</h2>
              <p>{selected.summary}</p>
            </div>
            <span className="status-pill" data-tone={selected.band === "needs-attention" ? "warning" : "positive"}>{bandLabel[selected.band]}</span>
          </div>
          <div className={styles.filters}>
            <button type="button" data-active={filter === "all"} onClick={() => setFilter("all")}>Todo</button>
            {(Object.keys(categoryCopy) as EvidenceCategory[]).map((category) => (
              <button type="button" key={category} data-active={filter === category} onClick={() => setFilter(category)}>{categoryCopy[category].label}</button>
            ))}
          </div>
          <div className={styles.evidenceList}>
            {evidence.map((item) => (
              <article key={item.id} data-category={item.category}>
                <span className={styles.evidenceIcon}>{item.category === "observed" ? <Eye size={17} /> : item.category === "inferred" ? <Sparkles size={17} /> : <Pencil size={17} />}</span>
                <div>
                  <div><strong>{categoryCopy[item.category].label}</strong><span>{Math.round(item.confidence * 100)}% confianza</span></div>
                  <p>{item.statement}</p>
                  <small>{item.source}</small>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.categoryLegend}>
            {(Object.keys(categoryCopy) as EvidenceCategory[]).map((category) => (
              <div key={category}><strong>{categoryCopy[category].label}</strong><p>{categoryCopy[category].description}</p></div>
            ))}
          </div>
        </section>

        <aside className={styles.sideColumn}>
          <section className={`${styles.projectionCard} glass`}>
            <span className="eyebrow"><Gauge size={14} /> Simulación, no promesa</span>
            <h2>¿Qué pasa con 20 min al día?</h2>
            <div className={styles.projectionChart} aria-label="Proyección de dominio para cuatro semanas">
              {[42, 52, 67, 76, 84].map((height, index) => <span key={index} style={{ height: `${height}%` }}><i>{index === 0 ? "Hoy" : `S${index}`}</i></span>)}
            </div>
            <p>Con la evidencia actual, LUMA estima que podrías demostrar la competencia de creencias en 3–4 semanas.</p>
            <div className={styles.assumption}><Info size={14} /><span>Supone 4 sesiones por semana y que la práctica guiada mejora la transferencia.</span></div>
            <button className="button-secondary" type="button">Comparar otra ruta <ArrowRight size={16} /></button>
          </section>

          <section className={`${styles.privacyCard} glass`}>
            <span className={styles.privacyIcon}><ShieldCheck size={22} /></span>
            <div><h2>Control del Twin</h2><p>Inspección, corrección, exportación y eliminación forman parte del producto, no de una política escondida.</p></div>
            <ul>
              <li><Check size={14} /> Sin inferencias de características protegidas</li>
              <li><Check size={14} /> Sin uso para presión comercial</li>
              <li><Check size={14} /> Trazabilidad por evento y fuente</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
