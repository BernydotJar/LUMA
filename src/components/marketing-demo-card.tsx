"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Play, Sparkles } from "lucide-react";
import { motion } from "motion/react";

export function MarketingDemoCard() {
  return (
    <motion.div
      className="marketing-demo-card glass"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.45 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="marketing-demo-card__header">
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Ahora para ti</span>
          <h3>Detecta un pensamiento que te sabotea</h3>
        </div>
        <span className="status-pill" data-tone="positive"><Sparkles size={13} /> 12 min</span>
      </div>
      <p>LUMA notó que comprendes el concepto, pero todavía cuesta reconocerlo en una situación real.</p>
      <div className="marketing-demo-card__reasons">
        <span><Check size={14} /> Basado en 7 evidencias</span>
        <span><Check size={14} /> Ajustado a tu tiempo</span>
        <span><Check size={14} /> Fuente verificable</span>
      </div>
      <div className="marketing-demo-card__footer">
        <Link className="button-primary" href="/learn/session/pas">
          <Play size={17} fill="currentColor" /> Iniciar práctica
        </Link>
        <Link className="button-ghost" href="/learn">
          Ver por qué <ArrowUpRight size={16} />
        </Link>
      </div>
    </motion.div>
  );
}
