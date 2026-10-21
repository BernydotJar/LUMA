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
import { CourseEnrollmentStatus } from "@/components/course-enrollment-status";
import { ExperienceShelf } from "@/components/experience-shelf";
import { LearningJourney } from "@/components/learning-journey";
import { LearnerGreeting } from "@/components/learner-greeting";
import { LearningPulse } from "@/components/learning-pulse";
import { LiveProgramSchedule } from "@/components/live-program-schedule";
import { NextActionCard } from "@/components/next-action-card";
import { ProgramEntryAssessment } from "@/components/program-entry-assessment";
import { ProgressStory } from "@/components/progress-story";
import { TutorPanel } from "@/components/tutor-panel";
import { useLumaAuth } from "@/components/auth-provider";
import { ProgramPicker, useProgramSelection } from "@/components/program-picker";
import { fetchPersistentLearningSnapshot, syncPendingLearningEvent, type PersistentLearningSnapshot } from "@/lib/learning-api-client";
import { guestLearningKeys } from "@/lib/learner-client-storage";
import { claimEntitledPrograms } from "@/lib/commerce-access-client";
import { firebaseAuth } from "@/lib/firebase-client";
import { createAdaptiveLearningPlan, parseStoredLearningEvent, parseStoredOnboarding } from "@/lib/learner-projection";
import { evidenceMayUpdateTwin } from "@/lib/simulation-evidence";
import styles from "@/app/learn/learn.module.css";

const emptyStorageSnapshot = JSON.stringify([null, null]);

function subscribeToLearningStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getLearningStorageSnapshot() {
  return JSON.stringify([
    window.localStorage.getItem(guestLearningKeys.onboarding),
    window.localStorage.getItem(guestLearningKeys.latestScored),
  ]);
}

function getServerLearningStorageSnapshot() {
  return emptyStorageSnapshot;
}

export function AdaptiveLearningHome() {
  const { user, loading } = useLumaAuth();
  const selection = useProgramSelection("learner");
  const programId = selection.status === "entitled" ? selection.programId : null;
  const [remoteState, setRemoteState] = useState<{
    uid: string; programId: string | null; snapshot: PersistentLearningSnapshot;
  } | null>(null);
  const [accessStatus, setAccessStatus] = useState<{
    uid: string; programId: string | null; error: string;
  } | null>(null);
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
    if (loading || !uid ||
        (selection.status !== "showcase" && !programId)) return;
    let cancelled = false;
    void (async () => {
      try {
        // A verified purchase claim precedes reading per-course evidence.
        await claimEntitledPrograms();
        const prior = await fetchPersistentLearningSnapshot();
        if (firebaseAuth.currentUser?.uid !== uid) return;
        if (prior && (prior.program?.programId ?? null) !== programId) {
          throw new Error("LEARNING_SCOPE_MISMATCH");
        }
        let changed = false;
        if (prior) {
          try {
            changed = Boolean(await syncPendingLearningEvent(prior, uid));
          } catch {
            // Retry failures do not replace the trusted server snapshot.
          }
        }
        const snapshot = changed ? await fetchPersistentLearningSnapshot() : prior;
        if (snapshot && (snapshot.program?.programId ?? null) !== programId) {
          throw new Error("LEARNING_SCOPE_MISMATCH");
        }
        if (!cancelled && firebaseAuth.currentUser?.uid === uid) {
          setRemoteState(snapshot ? { uid, programId, snapshot } : null);
          setAccessStatus(null);
        }
      } catch (error) {
        if (!cancelled) {
          // Never restore another account/course's state or a guest preview.
          setRemoteState(null);
          setAccessStatus({
            uid, programId,
            error: error instanceof Error ? error.message : "PLAN_UNAVAILABLE",
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [loading, user?.uid, programId, selection.status]);

  // Authenticated evidence must match both verified UID and chosen program.
  const snapshot = !loading && user && remoteState?.uid === user.uid &&
    remoteState.programId === programId ? remoteState.snapshot : undefined;
  const guest = !loading && !user;
  const entitled = selection.status === "entitled";
  const plan = snapshot?.plan ?? (guest ? localProjection.plan : createAdaptiveLearningPlan());
  const hasProfile = Boolean(snapshot || (guest && localProjection.hasOnboarding));
  const evidenceEvent = snapshot?.scoredEvidence ?? (
    guest && localProjection.event && evidenceMayUpdateTwin(localProjection.event)
      ? localProjection.event : undefined
  );
  const accessError = user && accessStatus?.uid === user.uid &&
    accessStatus.programId === programId ? accessStatus.error : null;
  const routeChangeCopy = hasProfile && plan.routeChanged && plan.previousAction
    ? plan.previousAction.title + " → " + plan.nextAction.title
    : undefined;

  if (user && selection.status !== "showcase" &&
      (selection.status !== "entitled" || !selection.programId)) {
    return (
      <AppShell title="Mi aprendizaje" subtitle="Elige el programa para continuar.">
        <div className={styles.home}>
          <ProgramPicker audience="learner" selection={selection} />
        </div>
      </AppShell>
    );
  }

  // The primary practice action remains above the fold on mobile. New
  // multicourse learners see ONLY the picker until an authorized course is
  // chosen; afterwards switching courses is a secondary action below the hero.
  const chosenCourseTitle = selection.courses.find(
    (course) => course.programId === programId,
  )?.title;
  return (
    <AppShell title="Mi aprendizaje" subtitle={chosenCourseTitle
      ? `Programa actual: ${chosenCourseTitle}`
      : "Un lugar para aprender, practicar y seguir avanzando."}>
      <div className={styles.home}>
        <CourseEnrollmentStatus />
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

        <ProgramPicker audience="learner" selection={selection} />
        {accessError && (
          <section className={styles.routeChange} role="alert">
            <Compass size={20} aria-hidden="true" />
            <div>
              <strong>{accessError.includes("403") ? "Tu inscripción requiere revisión" : "No pudimos recuperar tu avance"}</strong>
              <p>Tu información personal no se mostrará sin verificar tu cuenta y tu curso. Revisa el correo de compra o intenta ingresar de nuevo.</p>
            </div>
          </section>
        )}

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

        <ProgramEntryAssessment
          key={`${user?.uid ?? "guest"}:${programId ?? "showcase"}`}
          summary={plan.entryAssessment}
          hasProfile={hasProfile}
          userId={user?.uid}
          programId={programId}
          onPlanUpdate={() => {
            const uid = user?.uid;
            const selectedProgram = programId;
            if (!uid || !selectedProgram) return;
            void (async () => {
              try {
                const latest = await fetchPersistentLearningSnapshot();
                if (!latest || firebaseAuth.currentUser?.uid !== uid ||
                    (latest.program?.programId ?? null) !== selectedProgram) return;
                setRemoteState({ uid, programId: selectedProgram, snapshot: latest });
              } catch { /* Keep existing trusted projection if refresh fails. */ }
            })();
          }}
        />

        <LiveProgramSchedule activeProgramId={entitled ? programId : undefined} />

        <section className={styles.progressArea} aria-label="Avance y evidencia">
          <ProgressStory event={evidenceEvent} nextAction={plan.nextAction} source={snapshot?.scoredEvidence ? "server" : "preview"} />
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
          <TutorPanel key={`${user?.uid ?? "guest"}:${programId ?? "showcase"}`} />
        </div>

        <footer className={styles.footer}>
          <span>LUMA · Aprendizaje con propósito y evidencia.</span>
          <Link href="/learn/certificates">Mis certificados <ArrowRight size={15} aria-hidden="true" /></Link>
        </footer>
      </div>
    </AppShell>
  );
}
