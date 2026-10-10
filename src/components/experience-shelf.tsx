import Link from "next/link";
import { ArrowRight, MoveRight, BookOpen } from "lucide-react";
import { SemanticObject } from "@/components/semantic-object";
import { featuredLearningExperiences } from "@/lib/learning-content";
import styles from "./experience-shelf.module.css";

export function ExperienceShelf() {
  return (
    <section className={styles.section} aria-labelledby="experience-shelf-title">
      <header className={styles.heading}>
        <div>
          <span className="eyebrow"><BookOpen size={14} /> OTRAS EXPERIENCIAS</span>
          <h2 id="experience-shelf-title">Para seguir explorando.</h2>
        </div>
        <Link href="/learn/experiences">Ver todas <ArrowRight size={15} /></Link>
      </header>

      <div className={styles.fieldNotes}>
        {featuredLearningExperiences.map((experience, index) => (
          <article className={styles.note} data-index={index + 1} key={experience.id}>
            <span className={styles.index}>{String(index + 1).padStart(2, "0")}</span>
            <div className={styles.noteObject}>
              <SemanticObject variant={experience.semanticObject} size="sm" />
            </div>
            <div className={styles.noteCopy}>
              <span>{experience.category} · {experience.minutes} min</span>
              <h3>{experience.shortTitle}</h3>
              <p>{experience.capability}</p>
              <Link href={`/learn/experience/${experience.slug}`}>
                Abrir práctica <MoveRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
