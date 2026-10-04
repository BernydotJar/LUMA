import Link from "next/link";
import { ArrowUpRight, CalendarDays, Flame, Target, TimerReset, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LearningJourney } from "@/components/learning-journey";
import { NextActionCard } from "@/components/next-action-card";
import { TutorPanel } from "@/components/tutor-panel";
import { TwinSnapshot } from "@/components/twin-snapshot";
import { journeySteps, learnerState, nextAction, twinDimensions } from "@/lib/luma-data";
import styles from "./learn.module.css";

const metrics = [
  { icon: TrendingUp, label: "Progreso verificado", value: "+18%", detail: "esta semana" },
  { icon: TimerReset, label: "Tiempo efectivo", value: "42 min", detail: "sin contar pausas" },
  { icon: Flame, label: "Ritmo", value: "3 días", detail: "constancia actual" },
];

export default function LearnPage() {
  return (
    <AppShell
      title="Buenas noches, Mariana"
      subtitle="Tu ruta cambió con la evidencia de hoy."
      actions={<span className={styles.demoBadge}>Showcase · datos explicables</span>}
    >
      <section className={styles.goalBar}>
        <div className={styles.goalIcon}><Target size={22} /></div>
        <div>
          <span>Tu objetivo actual</span>
          <strong>{learnerState.goal}</strong>
        </div>
        <div className={styles.goalMeta}>
          <span><CalendarDays size={14} /> Meta de 6 semanas</span>
          <Link href="/onboarding">Ajustar <ArrowUpRight size={13} /></Link>
        </div>
      </section>

      <section className={styles.metrics} aria-label="Resumen semanal">
        {metrics.map(({ icon: Icon, label, value, detail }) => (
          <article className="glass-subtle" key={label}>
            <span><Icon size={18} /></span>
            <div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>
          </article>
        ))}
        <article className={`${styles.masteryMetric} glass-subtle`}>
          <div>
            <small>Competencias demostradas</small>
            <strong>4 <span>de 9</span></strong>
          </div>
          <div className={styles.masteryDots} role="img" aria-label="4 de 9 competencias demostradas">
            {Array.from({ length: 9 }, (_, index) => <span data-complete={index < 4} key={index} />)}
          </div>
        </article>
      </section>

      <div className={styles.primaryGrid}>
        <div className={styles.nextActionArea}><NextActionCard action={nextAction} /></div>
        <TwinSnapshot dimensions={twinDimensions} />
      </div>

      <div className={styles.secondaryGrid}>
        <LearningJourney steps={journeySteps} />
        <TutorPanel />
      </div>
    </AppShell>
  );
}
