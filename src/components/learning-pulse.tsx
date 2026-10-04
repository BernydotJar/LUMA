"use client";

import Link from "next/link";
import { ArrowUpRight, BrainCircuit, Sparkles, TrendingUp } from "lucide-react";
import type { TwinDimension } from "@/types/learning";
import styles from "./learning-pulse.module.css";

const ringLabels: Record<string, string> = {
  knowledge: "Sabe",
  application: "Aplica",
  confidence: "Confía",
};

export function LearningPulse({ dimensions }: { dimensions: TwinDimension[] }) {
  const focus = dimensions.filter((item) =>
    ["knowledge", "application", "confidence"].includes(item.id),
  );

  return (
    <aside className={styles.panel} aria-labelledby="learning-pulse-title">
      <div className={styles.panelGlow} aria-hidden="true" />
      <header>
        <span className={styles.kicker}><Sparkles size={14} /> Learning pulse</span>
        <Link href="/twin" aria-label="Abrir Learning Twin">
          <ArrowUpRight size={16} />
        </Link>
      </header>

      <div className={styles.stage} aria-hidden="true">
        <div className={styles.sun}>
          <span className={styles.sunCore}><BrainCircuit size={30} /></span>
          <span className={styles.orbitOne} />
          <span className={styles.orbitTwo} />
          <span className={styles.orbitThree} />
        </div>
        {focus.map((item, index) => (
          <span
            className={styles.floatingMetric}
            data-index={index}
            key={item.id}
          >
            <small>{ringLabels[item.id]}</small>
            <strong>{item.score}</strong>
          </span>
        ))}
      </div>

      <div className={styles.readout}>
        <span className={styles.signal}><TrendingUp size={14} /> +7 esta semana</span>
        <h2 id="learning-pulse-title">Sabes más de lo que logras aplicar.</h2>
        <p>
          Por eso LUMA saltó otra explicación y movió tu siguiente paso a práctica.
        </p>
      </div>
    </aside>
  );
}
