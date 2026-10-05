import { AppShell } from "@/components/app-shell";
import { LearningExperienceCard } from "@/components/learning-experience-card";
import { learningExperiences } from "@/lib/learning-content";
import styles from "./page.module.css";

export default function ExperiencesPage() {
  return (
    <AppShell title="Práctica" subtitle="Elige una capacidad y llévala a una situación concreta.">
      <section className={styles.hero}>
        <span className="eyebrow">Experiencias de aprendizaje</span>
        <h2>Contenido para usar.</h2>
      </section>
      <section className={styles.grid} aria-label="Experiencias disponibles">
        {learningExperiences.map((experience, index) => (
          <LearningExperienceCard experience={experience} featured={index === 0} key={experience.id} />
        ))}
      </section>
    </AppShell>
  );
}
