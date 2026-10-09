import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  GitFork,
  Search,
  Sparkles,
  Video,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ContentIntelligenceSearch } from "@/components/content-intelligence-search";
import styles from "./library.module.css";

export const metadata: Metadata = { title: "Contenido inteligente" };

const concepts = [
  ["Comunicación emocional", "Comprender", "Conectar ideas"],
  ["Pensamientos automáticos saboteadores", "Identificar", "Practicar"],
  ["Niveles lógicos", "Reconocer", "Aplicar"],
  ["Creencias y valores", "Contrastar", "Reflexionar"],
  ["Virus mentales", "Explorar", "Distinguir"],
  ["Identidad", "Integrar", "Transferir"],
];

const modules = [
  { id: 1, title: "Fundamentos", assets: "Base del programa", state: "Tema de referencia" },
  { id: 2, title: "Comunicación emocional", assets: "Comprender y relacionarse", state: "Tema de referencia" },
  { id: 3, title: "Redescubriendo tu poder", assets: "Reflexión y práctica", state: "Tema de referencia" },
  { id: 4, title: "Creencias y valores", assets: "Revisar interpretaciones", state: "Tema de referencia" },
  { id: 5, title: "Aplicación personal", assets: "Practicar en contexto", state: "Tema de referencia" },
  { id: 6, title: "Integración de aprendizajes", assets: "Consolidar capacidades", state: "Tema de referencia" },
  { id: 7, title: "Lenguaje corporal", assets: "Comunicación consciente", state: "Tema de referencia" },
];

export default function LibraryPage() {
  return (
    <AppShell mode="studio" title="Inteligencia de contenido" subtitle="Encuentra conceptos, fuentes y experiencias que apoyan los objetivos de aprendizaje.">
      <section className={`${styles.hero} content-surface`}>
        <div>
          <span className="eyebrow"><span className="eyebrow-dot" /> Contenido del programa</span>
          <h2>Módulo 3: Redescubriendo y transformando tu poder</h2>
          <p>Explora los temas del programa y lleva sus conceptos a la práctica. Las recomendaciones se apoyan en fuentes y objetivos de aprendizaje identificables.</p>
          <div className={styles.heroActions}>
            <Link className="button-primary" href="/learn/experiences"><BookOpen size={17} /> Explorar experiencias</Link>
            <Link className="button-secondary" href="/studio/class-intelligence">Revisar objetivos <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div className={styles.qualityScore}>
          <span>Tu siguiente acción</span>
          <strong>Explorar</strong>
          <p>Busca un concepto, revisa su contexto y elige una práctica para aplicarlo.</p>
        </div>
      </section>

      <section className={styles.pipeline}>
        {[
          [BookOpen, "Comprender", "Revisa los conceptos del programa"],
          [Search, "Encontrar", "Busca una respuesta en su contexto"],
          [Sparkles, "Practicar", "Aplica ideas a un caso concreto"],
          [Video, "Profundizar", "Continúa con una experiencia"],
          [Check, "Revisar", "Comprueba tu siguiente paso"],
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


      <ContentIntelligenceSearch />

      <div className={styles.mainGrid}>
        <section className={`${styles.graphCard} content-surface`}>
          <div className={styles.cardHeading}>
            <div><span className="eyebrow"><GitFork size={14} /> Mapa temático</span><h2>Ideas que puedes conectar y poner en práctica.</h2></div>
            <span className="status-pill" data-tone="positive">Referencia temática</span>
          </div>
          <div className={styles.graphCanvas} aria-label="Esquema de temas relacionados del programa">
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
          <section className={`${styles.assetCard} content-surface`}>
            <div className={styles.cardHeading}><div><span className="eyebrow"><BookOpen size={14} /> Recursos para continuar</span><h2>Elige una acción de aprendizaje</h2></div></div>
            <div className={styles.assetList}>
              <Link href="/learn/experiences"><span><BookOpen size={18} /></span><div><strong>Explorar experiencias</strong><small>Conoce objetivos, ejemplos y prácticas</small></div></Link>
              <Link href="/studio/class-intelligence"><span><Sparkles size={18} /></span><div><strong>Revisar aprendizajes</strong><small>Consulta la evidencia esperada de cada experiencia</small></div></Link>
            </div>
          </section>

          <section className={`${styles.authoringCard} content-surface`}>
            <span className="eyebrow"><Sparkles size={14} /> Inteligencia de aprendizaje</span>
            <h2>De contenido experto a inteligencia de aprendizaje.</h2>
            <p>Cada concepto conserva su fuente, contexto y criterio de calidad para convertirse en experiencias de aprendizaje precisas.</p>
            <div><span><Check size={14} /> Revisión experta</span><span>Procedencia preservada · cambios trazables</span></div>
          </section>
        </aside>
      </div>

      <section className={styles.moduleSection}>
        <div className={styles.sectionHeading}><div><span className="eyebrow"><BookOpen size={14} /> Temas de formación</span><h2>Conoce las áreas que conecta este programa.</h2></div><span>Mapa de referencia</span></div>
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
