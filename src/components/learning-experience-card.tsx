import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { SemanticObject } from "@/components/semantic-object";
import type { LearningExperience } from "@/lib/learning-content";
import styles from "./learning-experience-card.module.css";

export function LearningExperienceCard({
  experience,
  featured = false,
}: {
  experience: LearningExperience;
  featured?: boolean;
}) {
  return (
    <article className={styles.card} data-featured={featured || undefined}>
      <div className={styles.objectStage}>
        <SemanticObject variant={experience.semanticObject} size={featured ? "lg" : "md"} />
      </div>
      <div className={styles.copy}>
        <div className={styles.meta}>
          <span>{experience.category}</span>
          <span><Clock3 size={13} /> {experience.minutes} min</span>
        </div>
        <h3>{experience.title}</h3>
        <p>{experience.summary}</p>
        <div className={styles.capability}>
          <small>Vas a practicar</small>
          <strong>{experience.capability}</strong>
        </div>
        <Link href={`/learn/experience/${experience.slug}`}>
          Abrir experiencia <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}
