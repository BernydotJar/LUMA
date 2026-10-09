"use client";

import Image from "next/image";
import { Sparkles, Check } from "lucide-react";
import { useLumaTheme } from "@/components/theme-provider";
import { lumaThemes } from "@/lib/themes";
import styles from "./iconography-catalog.module.css";

const icons = [
  { id: "practice", label: "Práctica", concept: "Aplica lo aprendido en una situación real." },
  { id: "progress", label: "Progreso", concept: "Reconoce lo que ya puedes demostrar." },
  { id: "coach-insight", label: "Acompañamiento", concept: "Revisa dónde una orientación puede ayudar." },
  { id: "human-intervention", label: "Intervención humana", concept: "Acerca el apoyo adecuado en el momento oportuno." },
  { id: "voice", label: "Expresión", concept: "Fortalece la comunicación y la escucha." },
  { id: "video", label: "Contenido", concept: "Explora recursos que apoyan tu aprendizaje." },
] as const;

export function IconographyCatalog() {
  const { theme, setTheme } = useLumaTheme();
  const activeTheme = lumaThemes.find((item) => item.id === theme) ?? lumaThemes[0];

  return (
    <div className={styles.catalog}>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow"><Sparkles size={14} /> Apariencia del programa</span>
          <h2>Un lenguaje visual claro para cada experiencia.</h2>
          <p>
            Elige un tema que se ajuste al contexto de tu organización.
            Los símbolos conservan su significado en las diferentes apariencias.
          </p>
        </div>
        <div className={styles.receipt}>
          <Check size={20} />
          <div><small>Apariencia seleccionada</small><strong>{activeTheme.label}</strong></div>
        </div>
      </section>

      <section className={styles.themeBar} aria-label="Tema de apariencia">
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

      <section className={styles.grid} aria-label={`Símbolos en tema ${activeTheme.label}`}>
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
            <h3>{icon.label}</h3>
            <p>{icon.concept}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
