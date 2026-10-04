import Link from "next/link";
import { ArrowRight, BrainCircuit, TrendingUp } from "lucide-react";
import type { TwinDimension } from "@/types/learning";
import { ProgressRing } from "@/components/progress-ring";
import styles from "./learner-components.module.css";

const toneLabel: Record<TwinDimension["band"], string> = {
  strong: "Fuerte",
  developing: "En desarrollo",
  "needs-attention": "Necesita atención",
};

export function TwinSnapshot({ dimensions }: { dimensions: TwinDimension[] }) {
  const average = Math.round(dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length);

  return (
    <section className={`${styles.twinSnapshot} glass`} aria-labelledby="twin-snapshot-title">
      <div className={styles.cardHeading}>
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Mi Learning Twin</span>
          <h2 id="twin-snapshot-title">Lo que LUMA cree—y por qué</h2>
        </div>
        <span className={styles.twinIcon}><BrainCircuit size={21} /></span>
      </div>
      <div className={styles.twinOverview}>
        <ProgressRing value={average} size={104} stroke={9} label="señal" />
        <div>
          <strong>Tu base es sólida.</strong>
          <p>La aplicación práctica avanza más lento que el conocimiento conceptual.</p>
          <span><TrendingUp size={14} /> +7 puntos esta semana</span>
        </div>
      </div>
      <div className={styles.dimensionList}>
        {dimensions.slice(0, 4).map((dimension) => (
          <div className={styles.dimensionRow} key={dimension.id}>
            <div>
              <span>{dimension.label}</span>
              <small data-band={dimension.band}>{toneLabel[dimension.band]}</small>
            </div>
            <div className={styles.miniBar} role="progressbar" aria-label={dimension.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={dimension.score}>
              <span style={{ width: `${dimension.score}%` }} />
            </div>
            <strong>{dimension.score}</strong>
          </div>
        ))}
      </div>
      <Link className={styles.cardLink} href="/twin">
        Abrir mi Twin y su evidencia <ArrowRight size={16} />
      </Link>
    </section>
  );
}
