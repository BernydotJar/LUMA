"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Compass,
  MessageCircle,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ExperienceShelf } from "@/components/experience-shelf";
import { LearningJourney } from "@/components/learning-journey";
import { LearnerGreeting } from "@/components/learner-greeting";
import { LearningPulse } from "@/components/learning-pulse";
import { LiveProgramSchedule } from "@/components/live-program-schedule";
import { NextActionCard } from "@/components/next-action-card";
import { ProgressStory } from "@/components/progress-story";
import { TutorPanel } from "@/components/tutor-panel";
import { useLumaAuth } from "@/components/auth-provider";
import { fetchPersistentLearningPlan, syncPendingLearningEvent } from "@/lib/learning-api-client";
import { createAdaptiveLearningPlan, parseStoredLearningEvent, parseStoredOnboarding, type AdaptiveLearningPlan } from "@/lib/learner-projection";
import { evidenceMayUpdateTwin } from "@/lib/simulation-evidence";
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
  const { user, loading } = useLumaAuth();
  const [remotePlan, setRemotePlan] = useState<{ uid: string; plan: AdaptiveLearningPlan } | null>(null);
  const storageSnapshot = useSyncExternalStore(
    subscribeToLearningStorage,
    getLearningStorageSnapshot,
    getServerLearningStorageSnapshot,
  );

  const localProjection = useMemo(() => {
    const [onboardingRaw, eventRaw] = JSON.parse(storageSnapshot) as [string | null, string | null];
    const onboarding = parseStoredOnboarding(onboardingRaw);
    const event = parseStoredLearningEvent(eventRaw);
    return { plan: createAdaptiveLearningPlan(onboarding, event), event, hasOnboarding: Boolean(onboarding) };
  }, [storageSnapshot]);

  useEffect(() => {
    const uid = user?.uid;
    if (loading || !uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const synced = await syncPendingLearningEvent();
        const persistent = synced ?? await fetchPersistentLearningPlan();
        if (!cancelled && persistent) setRemotePlan({ uid, plan: persistent });
      } catch {
        // An available local practice remains usable while persistence is temporarily offline.
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user?.uid]);

  const persistent = remotePlan && remotePlan.uid === user?.uid ? remotePlan.plan : null;
  const plan = persistent ?? localProjection.plan;
  const hasProfile = localProjection.hasOnboarding || Boolean(persistent);
  const evidenceEvent = localProjection.event && evidenceMayUpdateTwin(localProjection.event)
    ? localProjection.event : undefined;
  const routeChangeCopy = hasProfile && plan.routeChanged && plan.previousAction
    ? plan.previousAction.title + " → " + plan.nextAction.title
    : undefined;

  return (
    <AppShell title="Mi aprendizaje" subtitle="Un lugar para aprender, practicar y seguir avanzando.">
      <div className={styles.home}>
        <section className={styles.intro} aria-labelledby="learner-home-title">
          <div className={styles.introCopy}>
            <span className={styles.eyebrow}>TU ESPACIO DE APRENDIZAJE <span aria-hidden="true">/</span> LUMA</span>
            <LearnerGreeting />
            <h2 id="learner-home-title">Aprender se nota <em>en lo que haces.</em></h2>
            <p className={styles.introBody}>
              Avanza con una práctica concreta, a tu ritmo. Tu recorrido toma forma con lo que decides aplicar.
            </p>
            {hasProfile ? (
              <div className={styles.goalLine}>
                <Target size={17} aria-hidden="true" />
                <span>{plan.state.goal}</span>
              </div>
            ) : (
              <Link className={styles.goalLine} href="/onboarding">
                <Target size={17} aria-hidden="true" />
                <span>Elige lo que quieres desarrollar</span>
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            )}
          </div>
          <NextActionCard action={plan.nextAction} personalized={hasProfile} variant="hero" />
        </section>

        {routeChangeCopy && (
          <section className={styles.routeChange} data-testid="route-changed" role="status">
            <Compass size={20} aria-hidden="true" />
            <div>
              <strong>Tu siguiente paso cambió</strong>
              <p>{routeChangeCopy}. La nueva recomendación utiliza la evidencia disponible.</p>
            </div>
          </section>
        )}

        <nav className={styles.quickNav} aria-label="Atajos de aprendizaje">
          <Link href="/learn/experiences">
            <BookOpen size={19} aria-hidden="true" />
            <span><strong>Explora tu programa</strong><small>Experiencias y prácticas</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/learn#journey">
            <Compass size={19} aria-hidden="true" />
            <span><strong>Consulta tu ruta</strong><small>Objetivo y próximos pasos</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/learn#luma">
            <MessageCircle size={19} aria-hidden="true" />
            <span><strong>Pregunta a LUMA</strong><small>Orientación sobre el material</small></span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>

        <LiveProgramSchedule />

        <section className={styles.progressArea} aria-label="Avance y evidencia">
          <ProgressStory event={evidenceEvent} nextAction={plan.nextAction} />
          <LearningPulse
            dimensions={plan.dimensions}
            personalized={hasProfile}
            hasVerifiedEvidence={Boolean(evidenceEvent)}
          />
        </section>

        <ExperienceShelf />

        <section className={styles.journeySection} id="journey" aria-labelledby="journey-overview-title">
          <div className={styles.sectionLead}>
            <div>
              <span className={styles.sectionEyebrow}>TU RECORRIDO</span>
              <h2 id="journey-overview-title">El camino también es tuyo.</h2>
              <p>Consulta tus etapas cuando quieras profundizar. Tu siguiente práctica siempre está a mano.</p>
            </div>
            <Link href="/learn/experiences" className={styles.textLink}>
              Ver programa <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <details className={styles.journeyDisclosure}>
            <summary>
              <span>{hasProfile ? "Ver mi ruta completa" : "Preparar mi ruta personal"}</span>
              <ChevronDown size={19} aria-hidden="true" />
            </summary>
            {hasProfile ? (
              <LearningJourney steps={plan.journey} />
            ) : (
              <div className={styles.guestJourney}>
                <h3>Una ruta empieza con una intención.</h3>
                <p>Comparte qué habilidad quieres fortalecer para organizar tus próximas prácticas.</p>
                <Link href="/onboarding" className="button-primary">Definir mi objetivo <ArrowRight size={17} /></Link>
              </div>
            )}
          </details>
        </section>

        <div className={styles.tutorSection}>
          <div className={styles.sectionLead}>
            <div>
              <span className={styles.sectionEyebrow}>APRENDER ACOMPAÑADO</span>
              <h2>Cuando surge una pregunta, tienes dónde llevarla.</h2>
              <p>LUMA puede ayudarte a encontrar un concepto, examinar un ejemplo o practicar una idea.</p>
            </div>
          </div>
          <TutorPanel />
        </div>

        <footer className={styles.footer}>
          <span>LUMA · Aprendizaje con propósito y evidencia.</span>
          <Link href="/learn/certificates">Mis certificados <ArrowRight size={15} aria-hidden="true" /></Link>
        </footer>
      </div>
    </AppShell>
  );
}
