import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Sparkles,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LearningJourney } from "@/components/learning-journey";
import { LearningPulse } from "@/components/learning-pulse";
import { NextActionCard } from "@/components/next-action-card";
import { TutorPanel } from "@/components/tutor-panel";
import { journeySteps, learnerState, nextAction, twinDimensions } from "@/lib/luma-data";
import styles from "./learn.module.css";

export default function LearnPage() {
  return (
    <AppShell
      title="Hoy"
      subtitle="LUMA ajustó tu ruta con la evidencia más reciente."
    >
      <section className={styles.intro}>
        <div className={styles.introCopy}>
          <span className={styles.datePill}><CalendarDays size={14} /> Tu sesión de hoy</span>
          <p className={styles.greeting}>Buenas noches, Mariana.</p>
          <h2>
            Hoy no necesitas otra lección.
            <em> Necesitas probarlo.</em>
          </h2>
          <p className={styles.introBody}>
            Ya entiendes la idea. Lo que todavía no aparece con consistencia es
            aplicarla bajo presión, así que LUMA cambió tu ruta.
          </p>
          <div className={styles.goalLine}>
            <Target size={16} />
            <span>{learnerState.goal}</span>
          </div>
        </div>

        <div className={styles.sessionBrief}>
          <span><Clock3 size={15} /> Tienes 12 minutos</span>
          <strong>Una práctica. Sin contenido de relleno.</strong>
          <Link href="/learn/session/pas">
            Continuar mi journey <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <div className={styles.primaryGrid}>
        <NextActionCard action={nextAction} />
        <LearningPulse dimensions={twinDimensions} />
      </div>

      <section className={styles.proofStrip} aria-label="Por qué cambió la ruta">
        <div><span>01</span><strong>Ya demostrado</strong><p>Comunicación emocional base.</p></div>
        <div><span>02</span><strong>Señal actual</strong><p>2 fallos al transferir el concepto.</p></div>
        <div><span>03</span><strong>Decisión LUMA</strong><p>Práctica antes de más teoría.</p></div>
        <div className={styles.proofResult}><Check size={17} /><strong>Ruta adaptada</strong><p>La siguiente lección quedó en pausa.</p></div>
      </section>

      <div className={styles.secondaryGrid}>
        <LearningJourney steps={journeySteps} />
        <TutorPanel />
      </div>

      <section className={styles.endNote}>
        <span><Sparkles size={14} /> LUMA observa evidencia, no tiempo mirando una pantalla.</span>
      </section>
    </AppShell>
  );
}
