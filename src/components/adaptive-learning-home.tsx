"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Sparkles,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExperienceShelf } from "@/components/experience-shelf";
import { LearningJourney } from "@/components/learning-journey";
import { LearnerGreeting } from "@/components/learner-greeting";
import { LearningPulse } from "@/components/learning-pulse";
import { ModuleCoverFlow } from "@/components/module-cover-flow";
import { NextActionCard } from "@/components/next-action-card";
import { ProgressStory } from "@/components/progress-story";
import { TutorPanel } from "@/components/tutor-panel";
import {
  createAdaptiveLearningPlan,
  parseStoredLearningEvent,
  parseStoredOnboarding,
} from "@/lib/learner-projection";
import styles from "@/app/learn/learn.module.css";

const emptyStorageSnapshot = JSON.stringify([null, null]);

function subscribeToLearningStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getLearningStorageSnapshot() {
  return JSON.stringify([
    window.localStorage.getItem("luma-onboarding"),
    window.localStorage.getItem("luma-latest-learning-event"),
  ]);
}

function getServerLearningStorageSnapshot() {
  return emptyStorageSnapshot;
}

export function AdaptiveLearningHome() {
  const storageSnapshot = useSyncExternalStore(
    subscribeToLearningStorage,
    getLearningStorageSnapshot,
    getServerLearningStorageSnapshot,
  );

  const plan = useMemo(() => {
    const [onboardingRaw, eventRaw] = JSON.parse(storageSnapshot) as [string | null, string | null];
    const onboarding = parseStoredOnboarding(onboardingRaw);
    const event = parseStoredLearningEvent(eventRaw);
    return createAdaptiveLearningPlan(onboarding, event);
  }, [storageSnapshot]);

  const actionHref = plan.nextAction.href ?? "/learn/experiences";
  const routeChangeCopy =
    plan.routeChanged && plan.previousAction
      ? `${plan.previousAction.title} → ${plan.nextAction.title}`
      : undefined;

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
            Tu objetivo, el tiempo disponible y la evidencia que vas generando
            determinan qué conviene hacer ahora. La ruta se vuelve a ordenar después de cada señal útil.
          </p>
          <div className={styles.goalLine}>
            <Target size={16} />
            <span>{plan.state.goal}</span>
          </div>
        </div>

        <div className={styles.sessionBrief}>
          <span><Clock3 size={15} /> Tienes {plan.state.availableMinutes} minutos</span>
          <strong>{plan.nextAction.title}</strong>
          <Link href={actionHref}>
            Continuar mi ruta <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {routeChangeCopy && (
        <section className={`${styles.routeChange} glass-subtle`} data-testid="route-changed">
          <Sparkles size={21} />
          <div>
            <span>Tu ruta cambió con la evidencia</span>
            <strong>{routeChangeCopy}</strong>
            <p>Ya no necesitas repetir la misma práctica. LUMA volvió a priorizar tu siguiente demostración.</p>
          </div>
        </section>
      )}

      <div className={styles.primaryGrid}>
        <NextActionCard action={plan.nextAction} />
        <LearningPulse dimensions={plan.dimensions} />
      </div>

      <ProgressStory />

      <ExperienceShelf />

      <ModuleCoverFlow compact />

      <section className={styles.proofStrip} aria-label="Cómo se adapta tu ruta">
        <div><span>01</span><strong>Objetivo activo</strong><p>{plan.state.goal}</p></div>
        <div><span>02</span><strong>Señal prioritaria</strong><p>{plan.nextAction.reason}</p></div>
        <div><span>03</span><strong>Acción de ahora</strong><p>{plan.nextAction.title} · {plan.nextAction.minutes} min.</p></div>
        <div className={styles.proofResult}><Check size={17} /><strong>Ruta viva</strong><p>Tu resultado vuelve a ordenar el siguiente movimiento.</p></div>
      </section>

      <div className={styles.secondaryGrid}>
        <LearningJourney steps={plan.journey} />
        <TutorPanel />
      </div>

      <section className={styles.endNote}>
        <span><Sparkles size={14} /> LUMA ajusta tu ruta con lo que demuestras en práctica.</span>
      </section>
    </AppShell>
  );
}
