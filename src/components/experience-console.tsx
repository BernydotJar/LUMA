"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Crown, Eye, Fingerprint, Layers3, Palette, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { LiquidGlassPreview } from "@/components/liquid-glass-preview";
import { SemanticObject } from "@/components/semantic-object";
import { useLumaTheme } from "@/components/theme-provider";
import { lumaThemes } from "@/lib/themes";
import styles from "./experience-console.module.css";

const capabilities = [
  { id: "practice", label: "Práctica", description: "Aplicar una idea en una situación concreta." },
  { id: "progress", label: "Progreso", description: "Reconocer capacidades respaldadas por evidencia." },
  { id: "coach-insight", label: "Acompañamiento", description: "Identificar cuándo conviene intervenir." },
  { id: "human-intervention", label: "Intervención", description: "Conectar a cada persona con apoyo oportuno." },
] as const;

const learningActions = [
  { label: "Define el objetivo", description: "Identifica la capacidad que la persona quiere desarrollar y su punto de partida.", href: "/onboarding", action: "Definir objetivo" },
  { label: "Llévalo a la práctica", description: "Trabaja con experiencias de aplicación y preguntas que favorecen el criterio propio.", href: "/learn/experiences", action: "Explorar experiencias" },
  { label: "Revisa qué necesita apoyo", description: "Consulta evidencia disponible y determina el siguiente acompañamiento.", href: "/studio", action: "Abrir seguimiento" },
] as const;

export function ExperienceConsole() {
  const { theme, setTheme } = useLumaTheme();

  return (
    <div className={styles.console}>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow"><Crown size={14} /> Configuración de experiencia</span>
          <h2>Una experiencia de aprendizaje conectada con las personas y sus objetivos.</h2>
          <p>
            Personaliza la presentación del programa y accede a las herramientas para
            aprender, practicar y acompañar el progreso con evidencia.
          </p>
          <div className={styles.heroActions}>
            <Link href="/learn">Ir a mi aprendizaje <ArrowRight size={16} /></Link>
            <Link href="/studio">Abrir seguimiento <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div className={styles.heroObjects} aria-hidden="true">
          <SemanticObject variant="prism" size="lg" />
          <SemanticObject variant="strata" size="md" />
        </div>
      </section>

      <section className={styles.themeSection} aria-labelledby="theme-system-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><Palette size={14} /> Apariencia</span>
            <h2 id="theme-system-title">Elige cómo quieres ver LUMA.</h2>
          </div>
          <span>Tu preferencia se conserva en este dispositivo</span>
        </div>
        <div className={styles.themeGrid}>
          {lumaThemes.map((item) => (
            <button
              aria-pressed={theme === item.id}
              className={styles.themeCard}
              data-active={theme === item.id}
              key={item.id}
              onClick={() => setTheme(item.id)}
              type="button"
            >
              <div className={styles.themePreview} data-theme-preview={item.id}>
                {item.id === "se" ? (
                  <Image
                    src="/brand/seres-de-excelencia/logo.png"
                    alt="Seres de Excelencia"
                    width={168}
                    height={40}
                    sizes="168px"
                  />
                ) : item.id === "light" ? (
                  <LiquidGlassPreview />
                ) : (
                  <span>{item.shortLabel}</span>
                )}
                {item.id !== "light" ? <><i /><i /><i /></> : null}
              </div>
              <span className={styles.themeMeta}>
                <small>{item.shortLabel}</small>
                <strong>{item.label}</strong>
                <p>{item.description}</p>
              </span>
              <span className={styles.palette} aria-label={`Paleta ${item.label}`}>
                {item.palette.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
              </span>
              <span className={styles.selectState}>
                {theme === item.id ? <><Check size={14} /> Activo</> : "Aplicar"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.iconSection} aria-labelledby="capabilities-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><Layers3 size={14} /> Capacidades de aprendizaje</span>
            <h2 id="capabilities-title">Cada señal ayuda a comprender el siguiente paso.</h2>
          </div>
          <Link href="/iconography">Personalizar apariencia <ArrowRight size={14} /></Link>
        </div>
        <div className={styles.iconGrid}>
          {capabilities.map((capability) => (
            <article key={capability.id}>
              <Image
                src={`/iconography/${theme}/${capability.id}.svg`}
                alt=""
                width={124}
                height={124}
                sizes="124px"
              />
              <small>{capability.label}</small>
              <strong>{capability.description}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.roleSection} aria-labelledby="role-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><Eye size={14} /> Espacios de trabajo</span>
            <h2 id="role-title">La persona practica. El entrenador acompaña.</h2>
          </div>
        </div>
        <div className={styles.roleGrid}>
          <article className={styles.coacheeCard}>
            <div className={styles.roleTop}><span><Fingerprint size={17} /> Participante</span></div>
            <h3>Avanza desde tu propia experiencia.</h3>
            <p>Conoce tu siguiente objetivo, aplica lo aprendido y recibe orientación según lo que necesitas reforzar.</p>
            <dl>
              <div><dt>Explora</dt><dd>Experiencias relevantes</dd></div>
              <div><dt>Practica</dt><dd>Situaciones y decisiones</dd></div>
              <div><dt>Avanza</dt><dd>Tu siguiente acción</dd></div>
            </dl>
            <Link href="/learn">Entrar a mi aprendizaje <ArrowRight size={15} /></Link>
          </article>
          <article className={styles.coachCard}>
            <div className={styles.roleTop}><span><UserRoundCheck size={17} /> Entrenador</span></div>
            <h3>Acompaña con contexto y evidencia.</h3>
            <p>Consulta las señales disponibles, prioriza casos que necesitan ayuda y orienta intervenciones humanas.</p>
            <dl>
              <div><dt>Consulta</dt><dd>Progreso con evidencia</dd></div>
              <div><dt>Prioriza</dt><dd>Necesidades de refuerzo</dd></div>
              <div><dt>Interviene</dt><dd>Seguimiento personalizado</dd></div>
            </dl>
            <Link href="/studio">Abrir seguimiento <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>

      <section className={styles.deliverySection} aria-labelledby="learning-actions-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><ShieldCheck size={14} /> Tu recorrido</span>
            <h2 id="learning-actions-title">Del objetivo a una acción que puedas demostrar.</h2>
          </div>
        </div>
        <div className={styles.deliveryGrid}>
          {learningActions.map((item) => (
            <article key={item.href}>
              <span><Sparkles size={20} /></span>
              <h3>{item.label}</h3>
              <p>{item.description}</p>
              <Link href={item.href}>{item.action} <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
