"use client";

import Image from "next/image";
import { Check, FileImage, Play, ShieldCheck, Sparkles } from "lucide-react";
import { useLumaTheme } from "@/components/theme-provider";
import { lumaThemes } from "@/lib/themes";
import styles from "./iconography-catalog.module.css";

const icons = [
  { id: "practice", label: "Práctica", metaphor: "Prisma refractivo", concept: "P.A.S. · reenfoque" },
  { id: "progress", label: "Progreso", metaphor: "Campo orbital", concept: "Capacidad demostrada" },
  { id: "coach-insight", label: "Perspectiva del entrenador", metaphor: "Estratos arquitectónicos", concept: "Nivel de intervención" },
  { id: "human-intervention", label: "Intervención humana", metaphor: "Puente / umbral", concept: "Evidencia + contexto" },
  { id: "voice", label: "Voz", metaphor: "Campo de resonancia", concept: "Expresión como práctica" },
  { id: "video", label: "Video", metaphor: "Frame editorial", concept: "Segmento + evidencia" },
] as const;

export function IconographyCatalog() {
  const { theme, setTheme } = useLumaTheme();
  const activeTheme = lumaThemes.find((item) => item.id === theme) ?? lumaThemes[0];

  return (
    <div className={styles.catalog}>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Iconografía LUMA</span>
          <h2>El significado permanece. El material cambia con el tema.</h2>
          <p>
            Seis objetos semánticos para práctica, progreso, perspectiva del entrenador, intervención humana,
            voz y video. El SVG es la base; el WebP animado entra después de aprobación.
          </p>
        </div>
        <div className={styles.receipt}>
          <ShieldCheck size={20} />
          <div><small>Política de activos</small><strong>Adulto · abstracto · accesible</strong></div>
        </div>
      </section>

      <section className={styles.themeBar} aria-label="Tema de iconografía">
        {lumaThemes.map((item) => (
          <button
            aria-pressed={theme === item.id}
            data-active={theme === item.id}
            key={item.id}
            onClick={() => setTheme(item.id)}
            type="button"
          >
            <span>{item.shortLabel}</span>
            <strong>{item.label}</strong>
          </button>
        ))}
      </section>

      <section className={styles.grid} aria-label={`Iconografía ${activeTheme.label}`}>
        {icons.map((icon) => (
          <article key={icon.id}>
            <div className={styles.imageFrame}>
              <Image
                src={`/iconography/${theme}/${icon.id}.svg`}
                alt=""
                width={256}
                height={256}
                sizes="(max-width: 700px) 44vw, 240px"
              />
            </div>
            <span>{icon.label}</span>
            <h3>{icon.metaphor}</h3>
            <p>{icon.concept}</p>
            <div className={styles.assetState}>
              <small><FileImage size={13} /> SVG baseline</small>
              <small><Play size={13} /> Movimiento controlado</small>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.pipeline}>
        <div>
          <span className="eyebrow"><Check size={14} /> Generación controlada</span>
          <h2>Una imagen estática aprobada antes de cada animación.</h2>
          <p>
            Prompt semántico → una imagen → revisión de producto → propuesta de movimiento →
            aprobación → bucle transparente → verificación → recibo de publicación.
          </p>
        </div>
        <ol>
          <li><span>01</span><strong>Imagen</strong><small>Una sola propuesta</small></li>
          <li><span>02</span><strong>Revisión</strong><small>Objeto, material, peso</small></li>
          <li><span>03</span><strong>Movimiento</strong><small>Una acción física</small></li>
          <li><span>04</span><strong>Verificación</strong><small>Bucle, alfa, peso</small></li>
        </ol>
      </section>
    </div>
  );
}
