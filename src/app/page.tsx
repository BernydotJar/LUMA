import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  ChartNoAxesCombined,
  CheckCircle2,
  Compass,
  FileCheck2,
  GraduationCap,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { LiquidOrb } from "@/components/liquid-orb";
import { MarketingDemoCard } from "@/components/marketing-demo-card";
import styles from "./page.module.css";

const principles = [
  {
    icon: Compass,
    label: "No empiezas en la lección 1",
    copy: "Tu meta, conocimiento previo y evidencia actual determinan la ruta.",
  },
  {
    icon: BrainCircuit,
    label: "Tu Twin aprende contigo",
    copy: "Distingue lo observado, lo inferido y lo que tú reportas.",
  },
  {
    icon: FileCheck2,
    label: "Cada recomendación se explica",
    copy: "Puedes inspeccionar la evidencia y volver a la fuente original.",
  },
];

const productViews = [
  {
    icon: GraduationCap,
    title: "Para quien aprende",
    copy: "Una sola pregunta domina la interfaz: ¿qué conviene hacer ahora para acercarme a mi meta?",
    href: "/learn",
    cta: "Abrir experiencia",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Para quien enseña",
    copy: "No solo vistas y finalización: conceptos difíciles, errores recurrentes e intervenciones que sí funcionan.",
    href: "/studio",
    cta: "Abrir Learning Studio",
  },
  {
    icon: Layers3,
    title: "Para quien crea",
    copy: "Contenido convertido en conceptos, práctica, evaluaciones y relaciones de aprendizaje con aprobación humana.",
    href: "/library",
    cta: "Ver contenido inteligente",
  },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <div className="page-noise" />
      <header className={styles.nav}>
        <BrandMark />
        <nav aria-label="Navegación principal">
          <a href="#product">Producto</a>
          <a href="#twin">Learning Twin</a>
          <a href="#trust">Confianza</a>
        </nav>
        <div className={styles.navActions}>
          <Link className="button-ghost" href="/studio">Vista instructor</Link>
          <Link className="button-secondary" href="/onboarding">Entrar a LUMA</Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className="eyebrow"><span className="eyebrow-dot" /> La inteligencia de aprender</span>
          <h1>Tu curso no debería decidir <em>cómo</em> aprendes.</h1>
          <p className={styles.heroLead}>
            LUMA entiende tu meta, lo que ya dominas y dónde te atoras para proponerte la mejor siguiente acción—con evidencia, no con una ruta genérica.
          </p>
          <div className={styles.heroActions}>
            <Link className="button-primary" href="/onboarding">
              Construir mi Learning Twin <ArrowRight size={18} />
            </Link>
            <Link className="button-secondary" href="/learn">Ver experiencia de cliente</Link>
          </div>
          <div className={styles.heroProof} aria-label="Capacidades clave">
            <span><CheckCircle2 size={16} /> Adaptación explicable</span>
            <span><CheckCircle2 size={16} /> Fuentes verificables</span>
            <span><CheckCircle2 size={16} /> Privacidad por diseño</span>
          </div>
        </div>
        <div className={styles.heroVisual}><LiquidOrb /></div>
      </section>

      <section className={styles.demoSection} id="product">
        <div className={styles.demoNarrative}>
          <span className="eyebrow"><span className="eyebrow-dot" /> De contenido a progreso</span>
          <h2>Una experiencia que se siente viva, no una carpeta de módulos.</h2>
          <p>
            LUMA combina el mapa del contenido con el estado real de cada persona. El resultado no es “más IA” sobre un LMS: es una interfaz que decide qué explicar, qué practicar, qué saltar y cuándo pedir apoyo humano.
          </p>
          <div className={styles.principles}>
            {principles.map(({ icon: Icon, label, copy }) => (
              <article key={label}>
                <span className={styles.principleIcon}><Icon size={19} /></span>
                <div><strong>{label}</strong><p>{copy}</p></div>
              </article>
            ))}
          </div>
        </div>
        <MarketingDemoCard />
      </section>

      <section className={styles.productGrid} id="twin">
        <div className={styles.sectionHeading}>
          <span className="eyebrow"><span className="eyebrow-dot" /> Un producto, tres perspectivas</span>
          <h2>Todos ven lo que necesitan. Nadie navega la complejidad interna.</h2>
        </div>
        <div className={styles.viewCards}>
          {productViews.map(({ icon: Icon, title, copy, href, cta }) => (
            <Link className={`${styles.viewCard} glass`} href={href} key={title}>
              <span className={styles.viewCardIcon}><Icon size={24} /></span>
              <h3>{title}</h3>
              <p>{copy}</p>
              <span>{cta} <ArrowRight size={16} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.trust} id="trust">
        <div className={`${styles.trustCard} glass`}>
          <div className={styles.trustIcon}><ShieldCheck size={36} /></div>
          <div>
            <span className="eyebrow"><span className="eyebrow-dot" /> Twin seguro y corregible</span>
            <h2>La IA propone. La evidencia manda.</h2>
            <p>
              LUMA separa hechos observados, inferencias y datos auto-reportados. Cada estado muestra confianza y procedencia; la persona puede inspeccionarlo y corregirlo.
            </p>
          </div>
          <Link className="button-secondary" href="/twin">
            Explorar mi Twin <Sparkles size={17} />
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <BrandMark />
        <p>LUMA sabe cómo aprendes. Tú decides hacia dónde.</p>
        <span>Product Showcase Release · 2026</span>
      </footer>
    </main>
  );
}
