import { AppShell } from "@/components/app-shell";
import { CourseLessonList } from "@/components/course-lesson-list";
import styles from "./course.module.css";

export default function CoursePage() {
  return (
    <AppShell title="Mis lecciones" subtitle="Material y continuidad de tu matrícula.">
      <div className={styles.root}>
        <header className={styles.intro}><span className="eyebrow">APRENDER A TU RITMO</span>
          <h1>Donde dejaste el hilo.</h1>
          <p>Continúa con las lecciones publicadas para tu programa. Cada recurso conserva su lugar, y cada práctica te ayuda a ponerlo a prueba.</p>
        </header>
        <CourseLessonList />
      </div>
    </AppShell>
  );
}
