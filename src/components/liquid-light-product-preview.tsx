import {
  ArrowUpRight,
  BookOpenText,
  BrainCircuit,
  ChevronRight,
  CircleUserRound,
  Compass,
  Gauge,
  Home,
  LibraryBig,
  MessageCircleMore,
  Mic2,
  Orbit,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import { LiquidGlassPreview } from "@/components/liquid-glass-preview";
import styles from "./liquid-light-product-preview.module.css";

const navItems = [
  [Home, "Inicio", true],
  [Compass, "Recorrido", false],
  [BookOpenText, "Práctica", false],
  [LibraryBig, "Biblioteca", false],
] as const;

export function LiquidLightProductPreview() {
  return (
    <main className={styles.previewPage}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.ambientOne} />
        <span className={styles.ambientTwo} />
        <span className={styles.ambientThree} />
      </div>

      <section className={styles.shell} aria-label="Vista previa LUMA Liquid Light v2">
        <aside className={styles.sidebar}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>L</span>
            <span>
              <strong>LUMA</strong>
              <small>learning intelligence</small>
            </span>
          </div>

          <nav className={styles.nav} aria-label="Navegación de ejemplo">
            {navItems.map(([Icon, label, active]) => (
              <span className={active ? styles.navActive : styles.navItem} key={label}>
                <Icon size={17} strokeWidth={1.9} />
                {label}
              </span>
            ))}
          </nav>

          <div className={styles.sidebarFooter}>
            <span className={styles.miniAvatar}>M</span>
            <span>
              <strong>Mariana</strong>
              <small>Practitioner</small>
            </span>
          </div>
        </aside>

        <div className={styles.content}>
          <header className={styles.topbar}>
            <div>
              <small>DOMINGO · 5 OCT</small>
              <strong>Buenos días, Mariana.</strong>
            </div>
            <div className={styles.topbarActions}>
              <span className={styles.searchPill}><Search size={15} /> Buscar</span>
              <span className={styles.profileButton}><CircleUserRound size={18} /></span>
            </div>
          </header>

          <div className={styles.previewBadge}>
            <Sparkles size={14} /> Vista previa · Liquid Light v2
          </div>

          <section className={styles.heroCard}>
            <div className={styles.heroCopy}>
              <span className={styles.kicker}>Tu siguiente mejor acción</span>
              <h1>Observar antes de interpretar.</h1>
              <p>
                Una práctica breve para separar evidencia de interpretación y mejorar
                la calidad de tus decisiones en conversaciones reales.
              </p>
              <div className={styles.heroActions}>
                <span className={styles.primaryAction}>Continuar práctica <ChevronRight size={16} /></span>
                <span className={styles.secondaryAction}>Ver por qué</span>
              </div>
              <div className={styles.heroMeta}>
                <span><Target size={14} /> 8 min</span>
                <span><Gauge size={14} /> dificultad adaptada</span>
              </div>
            </div>

            <div className={styles.heroVisual}>
              <div className={styles.refractiveStage}>
                <LiquidGlassPreview />
              </div>
              <span className={styles.floatingMetric}>
                <small>TRANSFERENCIA</small>
                <strong>+12%</strong>
              </span>
            </div>
          </section>

          <section className={styles.grid}>
            <article className={styles.glassCard}>
              <div className={styles.cardTop}>
                <span className={styles.iconBadge}><Orbit size={18} /></span>
                <span className={styles.signal}>EN PROGRESO</span>
              </div>
              <h2>Tu progreso ya se está volviendo capacidad.</h2>
              <p>Estás demostrando mejor calibración cuando reduces supuestos antes de responder.</p>
              <div className={styles.progressTrack}><span /></div>
              <div className={styles.cardBottom}>
                <span>67% consolidado</span>
                <span>Ver progreso <ArrowUpRight size={14} /></span>
              </div>
            </article>

            <article className={styles.glassCard}>
              <div className={styles.cardTop}>
                <span className={styles.iconBadge}><BrainCircuit size={18} /></span>
                <span className={styles.signal}>COACH INSIGHT</span>
              </div>
              <h2>Una observación útil para tu próxima conversación.</h2>
              <p>Cuando hay presión, tu patrón dominante es completar información antes de validarla.</p>
              <div className={styles.insightQuote}>
                “Haz una pregunta de evidencia antes de explicar.”
              </div>
              <div className={styles.cardBottom}>
                <span>Basado en 4 prácticas</span>
                <span>Explorar <ArrowUpRight size={14} /></span>
              </div>
            </article>
          </section>

          <section className={styles.bottomStrip}>
            <div>
              <span className={styles.iconBadge}><Mic2 size={18} /></span>
              <span>
                <small>PRÁCTICA HABLADA</small>
                <strong>Ensaya una conversación difícil con LUMA.</strong>
              </span>
            </div>
            <span className={styles.secondaryAction}>Iniciar</span>
          </section>
        </div>

        <div className={styles.askLuma}>
          <MessageCircleMore size={18} />
          <span>Pregúntale a LUMA</span>
        </div>
      </section>
    </main>
  );
}
