import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { LearningExperienceCard } from "@/components/learning-experience-card";
import { featuredLearningExperiences } from "@/lib/learning-content";
import styles from "./experience-shelf.module.css";

export function ExperienceShelf() {
  return (
    <section className={styles.section} aria-labelledby="experience-shelf-title">
      <div className={styles.heading}>
        <div>
          <span className="eyebrow"><Sparkles size={14} /> También puedes practicar</span>
          <h2 id="experience-shelf-title">Capacidades que puedes llevar a una situación real.</h2>
        </div>
        <Link href="/learn/experiences">Ver todas <ArrowRight size={15} /></Link>
      </div>
      <div className={styles.grid}>
        {featuredLearningExperiences.map((experience) => (
          <LearningExperienceCard experience={experience} key={experience.id} />
        ))}
      </div>
    </section>
  );
}
