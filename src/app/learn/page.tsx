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
import { LearnerGreeting } from "@/components/learner-greeting";
import { ExperienceShelf } from "@/components/experience-shelf";
import { LearningPulse } from "@/components/learning-pulse";
import { ModuleCoverFlow } from "@/components/module-cover-flow";
import { NextActionCard } from "@/components/next-action-card";
import { ProgressStory } from "@/components/progress-story";
import { TutorPanel } from "@/components/tutor-panel";
import { journeySteps, learnerState, nextAction, twinDimensions } from "@/lib/luma-data";
import styles from "./learn.module.css";

export default function LearnPage() {
  return (
    <AppShell
      title="Hoy"
      subtitle="LUMA ajustó tu sesión con la evidencia más reciente."
    >
      <section className={styles.intro}>
        <div className={styles.introCopy}>
          <span className={styles.datePill}><CalendarDays size={14} /> Tu sesión de hoy</span>
          <LearnerGreeting />
          <h2>
            Hoy llevas lo que sabes
            <em> a la práctica.</em>
          </h2>
          <p className={styles.introBody}>
            Ya reconoces la idea. La sesión de hoy fortalece cómo la aplicas
            cuando aparece presión y necesitas responder con claridad.
          </p>
          <div className={styles.goalLine}>
            <Target size={16} />
            <span>{learnerState.goal}</span>
          </div>
        </div>

        <div className={styles.sessionBrief}>
          <span><Clock3 size={15} /> Tienes 12 minutos</span>
          <strong>Una práctica enfocada en transferencia.</strong>
          <Link href="/learn/session/pas">
            Continuar mi ruta <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <div className={styles.primaryGrid}>
        <NextActionCard action={nextAction} />
        <LearningPulse dimensions={twinDimensions} />
      </div>

      <ProgressStory />

      <ExperienceShelf />

      <ModuleCoverFlow compact />

      <section className={styles.proofStrip} aria-label="Cómo se adapta tu ruta">
        <div><span>01</span><strong>Base demostrada</strong><p>Comunicación emocional con evidencia consistente.</p></div>
        <div><span>02</span><strong>Capacidad en desarrollo</strong><p>Aplicar P.A.S. en situaciones concretas.</p></div>
        <div><span>03</span><strong>Práctica de hoy</strong><p>Detectar, nombrar y reformular.</p></div>
        <div className={styles.proofResult}><Check size={17} /><strong>Siguiente paso preparado</strong><p>Creencias se activa con la próxima señal de transferencia.</p></div>
      </section>

      <div className={styles.secondaryGrid}>
        <LearningJourney steps={journeySteps} />
        <TutorPanel />
      </div>

      <section className={styles.endNote}>
        <span><Sparkles size={14} /> LUMA ajusta tu ruta con lo que demuestras en práctica.</span>
      </section>
    </AppShell>
  );
}
