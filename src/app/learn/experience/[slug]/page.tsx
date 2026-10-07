import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClassEntryDiagnostic } from "@/components/class-entry-diagnostic";
import { ExperienceReflection } from "@/components/experience-reflection";
import { SemanticObject } from "@/components/semantic-object";
import { getLearningExperience, learningExperiences } from "@/lib/learning-content";
import styles from "./page.module.css";

export function generateStaticParams() {
  return learningExperiences.map((item) => ({ slug: item.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const experience = getLearningExperience(slug);
  if (!experience) notFound();

  return (
    <AppShell title={experience.shortTitle} subtitle={experience.capability}>
      <Link className={styles.back} href="/learn/experiences"><ArrowLeft size={15} /> Volver</Link>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow">{experience.category} · {experience.minutes} min</span>
          <h2>{experience.title}</h2>
          <p>{experience.summary}</p>
        </div>
        <SemanticObject variant={experience.semanticObject} size="lg" />
      </section>
      <ClassEntryDiagnostic slug={experience.slug} />
      <div className={styles.grid}>
        <section className={styles.card} id="idea-clave">
          <span className="eyebrow">Idea clave</span>
          <h2>Lo esencial antes de practicar.</h2>
          <ul>{experience.keyIdeas.map((idea) => <li key={idea}><Check size={15} /> {idea}</li>)}</ul>
          <p className={styles.source}>{experience.sourceLabel} · {experience.sourceUnit}</p>
        </section>
        <section className={styles.card} id="practica">
          <span className="eyebrow">Práctica</span>
          <h2>{experience.practiceTitle}</h2>
          <p>{experience.scenario}</p>
          <ol>{experience.practiceSteps.map((step) => <li key={step}>{step}</li>)}</ol>
          {experience.scoredSimulationHref && <Link className={styles.simulation} href={experience.scoredSimulationHref}>Abrir simulación</Link>}
        </section>
      </div>
      <ExperienceReflection experience={experience} />
    </AppShell>
  );
}
