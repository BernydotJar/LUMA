"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleHelp, Layers3, MonitorCog, Sparkles } from "lucide-react";
import { LiquidGlassPreview } from "@/components/liquid-glass-preview";
import styles from "./optical-lab.module.css";

type Material = "regular" | "clear" | "solid";

const materials: Array<{ id: Material; label: string; description: string }> = [
  { id: "regular", label: "Regular", description: "Controles y popovers: lectura prioritaria." },
  { id: "clear", label: "Clear", description: "Solo superficies sobre medios visuales." },
  { id: "solid", label: "Content", description: "Paneles densos: contenido sin filtro de fondo." },
];

type GpuStatus = "checking" | "available" | "unavailable";

export function OpticalLab() {
  const [material, setMaterial] = useState<Material>("regular");
  const [gpuStatus, setGpuStatus] = useState<GpuStatus>("checking");
  const [reducedTransparency, setReducedTransparency] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const updatePreference = () => setReducedTransparency(preference.matches);
    const preferenceFrame = window.requestAnimationFrame(updatePreference);
    preference.addEventListener("change", updatePreference);

    let active = true;
    const gpu = (navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> };
    }).gpu;
    // Capability detection is observational: this route does not load a WebGPU lens.
    void Promise.resolve()
      .then(() => gpu?.requestAdapter() ?? null)
      .then(
        (adapter) => { if (active) setGpuStatus(adapter ? "available" : "unavailable"); },
        () => { if (active) setGpuStatus("unavailable"); },
      );

    return () => {
      active = false;
      window.cancelAnimationFrame(preferenceFrame);
      preference.removeEventListener("change", updatePreference);
    };
  }, []);

  const selected = materials.find((item) => item.id === material) ?? materials[0];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/experience" className={styles.back}>
          <ArrowLeft size={17} aria-hidden="true" /> Volver a LUMA
        </Link>
        <span className={styles.internal}>Laboratorio de diseño · v4</span>
      </header>

      <section className={styles.intro}>
        <span className="eyebrow"><Sparkles size={15} aria-hidden="true" /> Unified Optical System</span>
        <h1>El material acompaña a la interacción.</h1>
        <p>
          Una demostración acotada de materiales funcionales, contenido sólido y
          refracción SVG. El motor WebGPU de Glass-HQ no forma parte del runtime
          de producción.
        </p>
      </section>

      <section className={styles.selection} aria-label="Probar materiales ópticos">
        <div className={styles.selectionCopy}>
          <h2>Material de la superficie</h2>
          <p>{selected.description}</p>
        </div>
        <div className={styles.selector} role="group" aria-label="Elegir material">
          {materials.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={material === item.id}
              data-selected={material === item.id}
              onClick={() => setMaterial(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.specimen}>
          <div className={styles.specimenTop}>
            <span><Layers3 size={17} aria-hidden="true" /> Superficie interactiva</span>
            <strong>{selected.label}</strong>
          </div>
          <div className={styles.scene}>
            <div className={styles.ambientOne} aria-hidden="true" />
            <div className={styles.ambientTwo} aria-hidden="true" />
            <span className={styles.sceneWord} aria-hidden="true">LUMA</span>
            <div className={styles.sample} data-material={material}>
              <span className={styles.sampleIcon}><Check size={18} aria-hidden="true" /></span>
              <div>
                <strong>Tu próximo paso está listo</strong>
                <span>Continúa donde dejaste tu práctica.</span>
              </div>
            </div>
          </div>
          <p className={styles.caption}>
            El control conserva texto nítido; el material se adapta sin añadir capas
            de vidrio dentro de otras capas.
          </p>
        </section>

        <section className={styles.specimen}>
          <div className={styles.specimenTop}>
            <span><MonitorCog size={17} aria-hidden="true" /> Refracción acotada</span>
            <strong>SVG + DOM</strong>
          </div>
          <div className={styles.refractiveStage}>
            <LiquidGlassPreview />
          </div>
          <p className={styles.caption}>
            La lente duplica únicamente una escena estable y aplica desplazamiento
            SVG. No refracta indiscriminadamente todo el producto.
          </p>
        </section>
      </div>

      <section className={styles.diagnostics} aria-label="Compatibilidad y accesibilidad">
        <div>
          <CircleHelp size={18} aria-hidden="true" />
          <span>
            <strong>Transparencia reducida</strong>
            <small>{reducedTransparency ? "Activa: se omiten filtros y refracción" : "Inactiva: material disponible"}</small>
          </span>
        </div>
        <div>
          <MonitorCog size={18} aria-hidden="true" />
          <span>
            <strong>Adaptador WebGPU</strong>
            <small>
              {gpuStatus === "checking" ? "Comprobando compatibilidad" :
                gpuStatus === "available" ? "Disponible para futuras pruebas" : "No disponible: fallback CSS/SVG"}
            </small>
          </span>
        </div>
      </section>
    </main>
  );
}
