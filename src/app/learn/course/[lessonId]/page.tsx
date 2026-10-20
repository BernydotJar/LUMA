import { AppShell } from "@/components/app-shell";
import { CourseLessonPlayer } from "@/components/course-lesson-player";
import styles from "../player.module.css";

export default async function LessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  return (
    <AppShell title="Mi lección" subtitle="Contenido verificado y continuidad de aprendizaje.">
      <div className={styles.root}><CourseLessonPlayer lessonId={lessonId} /></div>
    </AppShell>
  );
}
