"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Check,
  Crown,
  Eye,
  Film,
  Fingerprint,
  Layers3,
  Palette,
  Play,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { LiquidGlassPreview } from "@/components/liquid-glass-preview";
import { SemanticObject } from "@/components/semantic-object";
import { useLumaTheme } from "@/components/theme-provider";
import { lumaThemes } from "@/lib/themes";
import { iconStillCandidate, publicVideoDemo, showcaseVideoSources, showcaseVideoSummary, voicePrototype } from "@/lib/showcase-media";
import styles from "./experience-console.module.css";


const iconography = [
  ["practice", "Práctica", "Prisma · reenfoque"],
  ["progress", "Progreso", "Órbita · capacidad"],
  ["coach-insight", "Perspectiva del entrenador", "Estratos · intervención"],
  ["human-intervention", "Intervención humana", "Puente · contexto"],
  ["voice", "Voz", "Resonancia · expresión"],
  ["video", "Video", "Frame · fuente"],
] as const;

const deliveryTracks = [
  {
    id: "LUMA-022",
    title: "Iconografía semántica",
    status: "Imagen 3D en revisión",
    description: "Seis significados, tres temas y un primer candidato Gemini con movimiento bloqueado hasta aprobación.",
    icon: Layers3,
  },
  {
    id: "LUMA-024",
    title: "Voz original SE",
    status: "Prototipo 01 listo",
    description: "Flujo de voz probado con dirección original; la identidad final sigue sujeta a revisión de tono y derechos.",
    icon: AudioLines,
  },
  {
    id: "LUMA-025",
    title: "Flujo de aprendizaje en video",
    status: "5 clases verificadas",
    description: "15.82 GiB privados inventariados; el primer clip queda detrás del control de derechos y selección de segmento.",
    icon: Film,
  },
];

export function ExperienceConsole() {
  const { theme, setTheme } = useLumaTheme();
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <div className={styles.console}>
      <section className={styles.hero}>
        <div>
          <span className="eyebrow"><Crown size={14} /> Experiencia de superusuario</span>
          <h2>Una plataforma. Dos experiencias. Tres expresiones visuales.</h2>
          <p>
            Desde aquí puedes revisar la experiencia del participante, la inteligencia del entrenador
            y la identidad visual antes de asignarlas a perfiles y organizaciones.
          </p>
          <div className={styles.heroActions}>
            <Link href="/learn">Abrir participante <ArrowRight size={16} /></Link>
            <Link href="/studio">Abrir entrenador <ArrowRight size={16} /></Link>
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
            <span className="eyebrow"><Palette size={14} /> Sistema de temas</span>
            <h2 id="theme-system-title">Elige cómo se presenta LUMA.</h2>
          </div>
          <span>Persistencia local · perfiles después</span>
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

      <section className={styles.iconSection} aria-labelledby="iconography-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><Layers3 size={14} /> Iconografía</span>
            <h2 id="iconography-title">Un mismo significado, expresado en cada tema.</h2>
          </div>
          <Link href="/iconography">Abrir catálogo <ArrowRight size={14} /></Link>
        </div>
        <div className={styles.iconGrid}>
          {iconography.map(([id, label, metaphor]) => (
            <article key={id}>
              <Image
                src={`/iconography/${theme}/${id}.svg`}
                alt=""
                width={124}
                height={124}
                sizes="124px"
              />
              <small>{label}</small>
              <strong>{metaphor}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.labSection} aria-labelledby="review-lab-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><Sparkles size={14} /> Laboratorio de revisión</span>
            <h2 id="review-lab-title">Activos reales, visibles antes de publicarlos.</h2>
          </div>
          <span>Superusuario · controles explícitos</span>
        </div>

        <div className={styles.labGrid}>
          <article className={styles.iconCandidate}>
            <div className={styles.labTop}>
              <span><Layers3 size={16} /> Iconografía 3D</span>
              <small>{iconStillCandidate.status}</small>
            </div>
            <div className={styles.candidateStage}>
              <Image
                src={iconStillCandidate.path}
                alt="Candidato 3D de práctica P.A.S. para el tema Seres de Excelencia"
                width={512}
                height={512}
                sizes="(max-width: 760px) 74vw, 280px"
              />
            </div>
            <h3>{iconStillCandidate.label}</h3>
            <p>Prisma de refracción para representar interpretación y reenfoque. Este still todavía no sustituye la iconografía publicada.</p>
            <div className={styles.reviewReceipt}>
              <span>Imagen</span><strong>1/1 generado</strong>
              <span>Movimiento</span><strong>Bloqueado hasta aprobación</strong>
            </div>
          </article>

          <article>
            <div className={styles.labTop}>
              <span><AudioLines size={16} /> Voz</span>
              <small>{voicePrototype.status}</small>
            </div>
            <SemanticObject variant="axis" size="md" className={styles.labObject} />
            <h3>{voicePrototype.label}</h3>
            <p>Prueba de dirección vocal para acompañamiento en español: pausada, clara y adulta. Es una voz original de trabajo, no una imitación de una persona identificable.</p>
            <audio
              className={styles.audioPlayer}
              controls
              preload="metadata"
              src={voicePrototype.path}
            >
              Tu navegador no puede reproducir este audio.
            </audio>
            <div className={styles.reviewReceipt}>
              <span>Duración</span><strong>{voicePrototype.durationSeconds}s</strong>
              <span>Uso</span><strong>Práctica hablada</strong>
            </div>
          </article>

          <article>
            <div className={styles.labTop}>
              <span><Film size={16} /> Capa de fuentes de video</span>
              <small>{showcaseVideoSummary.rightsState}</small>
            </div>
            <div className={styles.videoFrame}>
              {videoOpen ? (
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  src={publicVideoDemo.embedUrl}
                  title={publicVideoDemo.title}
                />
              ) : (
                <button
                  aria-label="Reproducir video público de Seres de Excelencia"
                  className={styles.videoPoster}
                  onClick={() => setVideoOpen(true)}
                  type="button"
                >
                  <Image
                    alt=""
                    fill
                    sizes="(max-width: 760px) 88vw, 360px"
                    src={publicVideoDemo.posterPath}
                  />
                  <span><Play size={17} fill="currentColor" /> Reproducir demo</span>
                </button>
              )}
            </div>
            <h3>{publicVideoDemo.title}</h3>
            <p>{publicVideoDemo.author}. Este video público demuestra la experiencia audiovisual sin exponer el corpus privado del programa.</p>
            <div className={styles.reviewReceipt}>
              <span>Fuente</span><strong>{publicVideoDemo.status}</strong>
              <span>Evidencia</span><strong>Exposición ≠ dominio</strong>
            </div>
            <details className={styles.privateInventory}>
              <summary>{showcaseVideoSummary.count} clases privadas · {showcaseVideoSummary.totalGiB} GiB</summary>
              <div className={styles.videoMiniList}>
                {showcaseVideoSources.map((source) => (
                  <span key={source.label}>
                    <strong>{source.label}</strong>
                    <small>{source.sizeGiB} GiB · privada</small>
                  </span>
                ))}
              </div>
            </details>
          </article>
        </div>
      </section>

      <section className={styles.roleSection} aria-labelledby="role-preview-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><Eye size={14} /> Vista de roles</span>
            <h2 id="role-preview-title">El participante actúa. El entrenador interpreta e interviene.</h2>
          </div>
          <span>Vista conjunta de superusuario</span>
        </div>
        <div className={styles.roleGrid}>
          <article className={styles.coacheeCard}>
            <div className={styles.roleTop}>
              <span><Fingerprint size={17} /> Participante</span>
              <small>Mariana · Practitioner</small>
            </div>
            <h3>Hoy llevas lo que sabes a la práctica.</h3>
            <p>Una acción relevante, progreso expresado en capacidades y ayuda contextual.</p>
            <dl>
              <div><dt>Ahora</dt><dd>Detectar un P.A.S.</dd></div>
              <div><dt>Demostrado</dt><dd>Hecho vs. interpretación</dd></div>
              <div><dt>Después</dt><dd>Transferencia autónoma</dd></div>
            </dl>
            <Link href="/learn">Entrar como participante <ArrowRight size={15} /></Link>
          </article>

          <article className={styles.coachCard}>
            <div className={styles.roleTop}>
              <span><UserRoundCheck size={17} /> Entrenador</span>
              <small>Espacio de inteligencia</small>
            </div>
            <h3>Mariana: evidencia, confianza y siguiente intervención.</h3>
            <p>Gemelo de aprendizaje, procedencia, escenarios y contexto humano para tomar una decisión.</p>
            <dl>
              <div><dt>Aplicación</dt><dd>58 · foco</dd></div>
              <div><dt>Confianza</dt><dd>46 · calibrar</dd></div>
              <div><dt>Intervención</dt><dd>Pregunta socrática</dd></div>
            </dl>
            <Link href="/studio/learners/mariana">Abrir Inteligencia del entrenador <ArrowRight size={15} /></Link>
          </article>
        </div>
      </section>

      <section className={styles.profileSection}>
        <div>
          <span className="eyebrow"><ShieldCheck size={14} /> Arquitectura de perfiles</span>
          <h2>Hoy eres superusuario; mañana el acceso se deriva del perfil.</h2>
          <p>
            El control actual permite comparar experiencias. La siguiente capa asignará organización,
            rol, tema, preferencias de modalidad y permisos a cada identidad.
          </p>
        </div>
        <div className={styles.profileRail}>
          <span data-active="true"><Crown size={15} /> Eduardo · Superusuario</span>
          <span>Mariana · Participante</span>
          <span>Entrenador · Practitioner</span>
          <span>Admin SE · Organización</span>
        </div>
      </section>

      <section className={styles.deliverySection} aria-labelledby="delivery-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className="eyebrow"><Sparkles size={14} /> Grafos de entrega</span>
            <h2 id="delivery-title">Los siguientes incrementos ya tienen frontera y evidencia.</h2>
          </div>
        </div>
        <div className={styles.deliveryGrid}>
          {deliveryTracks.map(({ icon: Icon, ...track }) => (
            <article key={track.id}>
              <span><Icon size={20} /></span>
              <small>{track.id}</small>
              <h3>{track.title}</h3>
              <strong>{track.status}</strong>
              <p>{track.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
