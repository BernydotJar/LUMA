import { AppShell } from "@/components/app-shell";
import { CourseEnrollmentStatus } from "@/components/course-enrollment-status";
import { LearningExperienceCard } from "@/components/learning-experience-card";
import { ModuleCoverFlow } from "@/components/module-cover-flow";
import { learningExperiences } from "@/lib/learning-content";
import styles from "./page.module.css";

export default function ExperiencesPage() {
  return (
    <AppShell title="Práctica" subtitle="Explora muestras y las actividades disponibles para tu matrícula.">
      <CourseEnrollmentStatus />
      <section className={styles.hero}>
        <span className="eyebrow">Experiencias de aprendizaje</span>
        <h2>Tu programa, convertido en práctica.</h2>
      </section>
      <ModuleCoverFlow />

      <section className={styles.practiceIntro}><span className="eyebrow">Prácticas digitales</span><h2>Elige una capacidad y llévala a una situación real.</h2></section>

      <section className={styles.grid} aria-label="Experiencias disponibles">
        {learningExperiences.map((experience, index) => (
          <LearningExperienceCard experience={experience} featured={index === 0} key={experience.id} />
        ))}
      </section>
    </AppShell>
  );
}
