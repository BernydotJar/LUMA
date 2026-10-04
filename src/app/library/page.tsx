import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileArchive,
  FileText,
  GitFork,
  PlayCircle,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { moduleThreeSource } from "@/lib/luma-data";
import styles from "./library.module.css";

export const metadata: Metadata = { title: "Contenido inteligente" };

const concepts = [
  ["Comunicación emocional", "6 relaciones", "Fuerte"],
  ["Pensamientos automáticos saboteadores", "9 relaciones", "En práctica"],
  ["Niveles lógicos", "7 relaciones", "En desarrollo"],
  ["Creencias y valores", "12 relaciones", "Prerrequisitos"],
  ["Virus mentales", "8 relaciones", "Pendiente"],
  ["Identidad", "5 relaciones", "Pendiente"],
];

const modules = [
  { id: 1, title: "Fundamentos", assets: "Clases + material de apoyo", state: "Inventariado" },
  { id: 2, title: "Practitioner · Módulo 2", assets: "5 videos · 1 PDF", state: "Inventariado" },
  { id: 3, title: "Redescubriendo tu poder", assets: "3 videos · 1 PDF · libros", state: "Vertical slice" },
  { id: 4, title: "Practitioner · Módulo 4", assets: "5 videos · material extra", state: "Inventariado" },
  { id: 5, title: "Practitioner · Módulo 5", assets: "5 videos", state: "Inventariado" },
  { id: 6, title: "Practitioner · Módulo 6", assets: "5 videos", state: "Inventariado" },
  { id: 7, title: "Lenguaje corporal", assets: "5 videos · material adicional", state: "Inventariado" },
];

export default function LibraryPage() {
  return (
    <AppShell mode="studio" title="Content Intelligence" subtitle="El corpus aporta estructura; LUMA lo conecta con capacidades, evidencia y decisiones de aprendizaje.">
      <section className={`${styles.hero} glass`}>
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Corpus conectado</span>
          <h2>Módulo 3: Redescubriendo y transformando tu poder</h2>
          <p>Este vertical slice fue seleccionado porque combina clases extensas, documento estructurado y material de apoyo. LUMA preserva la procedencia de cada concepto, evaluación y recomendación.</p>
          <div className={styles.heroActions}>
            <a className="button-primary" href={moduleThreeSource.url} target="_blank" rel="noreferrer"><FileText size={17} /> Abrir fuente original</a>
            <Link className="button-secondary" href="/learn">Ver experiencia generada <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div className={styles.qualityScore}>
          <span>Learning Quality</span>
          <strong>86</strong>
          <div><i style={{ width: "86%" }} /></div>
          <p>Alta cobertura conceptual; 2 objetivos están en revisión de alineación.</p>
        </div>
      </section>

      <section className={styles.pipeline}>
        {[
          [Video, "Video y audio", "3 clases conectadas"],
          [FileText, "Extracción", "8 secciones estructuradas"],
          [Sparkles, "Conceptos", "24 nodos propuestos"],
          [GitFork, "Grafo", "47 relaciones trazables"],
          [Search, "Búsqueda", "Segmentos recuperables"],
        ].map(([Icon, label, detail], index) => {
          const PipelineIcon = Icon as typeof Video;
          return (
            <article className="glass-subtle" key={String(label)}>
              <span><PipelineIcon size={19} /></span>
              <div><small>{index + 1}</small><strong>{String(label)}</strong><p>{String(detail)}</p></div>
              <Check size={15} />
            </article>
          );
        })}
      </section>

      <div className={styles.mainGrid}>
        <section className={`${styles.graphCard} glass`}>
          <div className={styles.cardHeading}>
            <div><span className="eyebrow"><GitFork size={14} /> Mapa de aprendizaje</span><h2>El contenido se convierte en relaciones.</h2></div>
            <span className="status-pill" data-tone="positive">47 relaciones</span>
          </div>
          <div className={styles.graphCanvas} aria-label="Vista del grafo de conocimiento">
            <div className={styles.graphCenter}>Cambio personal<span>competencia</span></div>
            <div className={`${styles.graphNode} ${styles.nodeOne}`}>Emoción<span>prerrequisito</span></div>
            <div className={`${styles.graphNode} ${styles.nodeTwo}`}>P.A.S.<span>concepto</span></div>
            <div className={`${styles.graphNode} ${styles.nodeThree}`}>Niveles lógicos<span>modelo</span></div>
            <div className={`${styles.graphNode} ${styles.nodeFour}`}>Creencias<span>práctica</span></div>
            <div className={`${styles.graphNode} ${styles.nodeFive}`}>Identidad<span>objetivo</span></div>
            <svg viewBox="0 0 800 420" aria-hidden="true"><path d="M160 95 C280 115 310 190 390 205 M648 82 C535 110 515 170 410 203 M120 315 C255 285 295 230 390 210 M675 310 C540 285 500 230 412 210 M402 340 C400 290 401 256 401 224" /></svg>
          </div>
          <div className={styles.conceptList}>
            {concepts.map(([name, relations, state]) => (
              <div key={name}><span>{name}</span><small>{relations}</small><strong>{state}</strong></div>
            ))}
          </div>
        </section>

        <aside className={styles.assetColumn}>
          <section className={`${styles.assetCard} glass`}>
            <div className={styles.cardHeading}><div><span className="eyebrow"><BookOpen size={14} /> Fuentes del slice</span><h2>4 activos principales</h2></div></div>
            <div className={styles.assetList}>
              <a href={moduleThreeSource.url} target="_blank" rel="noreferrer"><span><FileText size={18} /></span><div><strong>Redescubriendo y transformando tu poder</strong><small>PDF · 0.88 MB · 8 secciones</small></div></a>
              <div><span><PlayCircle size={18} /></span><div><strong>Clase 1 PM · miércoles</strong><small>Video · 2.45 GB · transcripción pendiente</small></div></div>
              <div><span><PlayCircle size={18} /></span><div><strong>Clase 2 PM</strong><small>Video · 3.21 GB · transcripción pendiente</small></div></div>
              <div><span><PlayCircle size={18} /></span><div><strong>Clase 3 PM</strong><small>Video · 2.88 GB · transcripción pendiente</small></div></div>
              <div><span><FileArchive size={18} /></span><div><strong>Libros de apoyo</strong><small>ZIP · 6.78 MB · revisión de licencia requerida</small></div></div>
            </div>
          </section>

          <section className={`${styles.authoringCard} glass`}>
            <span className="eyebrow"><Sparkles size={14} /> AI-native authoring</span>
            <h2>La IA propone. El experto publica.</h2>
            <p>Objetivos, capítulos, conceptos, ejercicios y relaciones se generan como borradores con fuente. Cada publicación conserva procedencia y revisión experta.</p>
            <div><span><Check size={14} /> 18 conceptos aprobados</span><span>6 pendientes de revisión</span></div>
          </section>
        </aside>
      </div>

      <section className={styles.moduleSection}>
        <div className={styles.sectionHeading}><div><span className="eyebrow"><BookOpen size={14} /> Vista secundaria del currículo</span><h2>Los módulos conservan la estructura editorial; el journey se organiza por capacidades y evidencia.</h2></div><span>7 módulos detectados</span></div>
        <div className={styles.moduleGrid}>
          {modules.map((module) => (
            <article className="glass-subtle" key={module.id} data-active={module.id === 3}>
              <span>{String(module.id).padStart(2, "0")}</span>
              <h3>{module.title}</h3>
              <p>{module.assets}</p>
              <strong>{module.state}</strong>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
