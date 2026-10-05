"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, BookOpenCheck, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { programModules } from "@/lib/program-modules";
import styles from "./module-cover-flow.module.css";

const statusLabel = {
  disponible: "Disponible",
  "en-curso": "En tu ruta",
  revision: "En revisión editorial",
} as const;

export function ModuleCoverFlow({ compact = false }: { compact?: boolean }) {
  const [activeIndex, setActiveIndex] = useState(2);
  const [mobile, setMobile] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const sync = () => setMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  const active = programModules[activeIndex];

  const move = (direction: number) => {
    setActiveIndex((current) => Math.min(programModules.length - 1, Math.max(0, current + direction)));
  };

  return (
    <section className={styles.section} data-compact={compact || undefined} id="programa" aria-labelledby="program-title">
      <div className={styles.heading}>
        <div>
          <span className="eyebrow"><BookOpenCheck size={14} /> Programa Practitioner</span>
          <h2 id="program-title">Siete módulos. Una sola ruta de transformación.</h2>
        </div>
        <p>
          Explora el programa completo. LUMA convierte el material en prácticas digitales a medida que cada experiencia supera revisión editorial y de evidencia.
        </p>
      </div>

      <div className={styles.stage} style={{ perspective: "1200px" }}>
        <button
          aria-label="Módulo anterior"
          className={styles.arrow}
          data-side="left"
          disabled={activeIndex === 0}
          onClick={() => move(-1)}
          type="button"
        >
          <ChevronLeft size={20} />
        </button>

        <div className={styles.deck}>
          {programModules.map((module, index) => {
            const offset = index - activeIndex;
            const distance = Math.abs(offset);
            const activeCard = index === activeIndex;
            return (
              <motion.button
                aria-label={`Seleccionar ${module.title}`}
                aria-pressed={activeCard}
                className={styles.coverButton}
                data-active={activeCard || undefined}
                data-module={module.number}
                drag={activeCard && !reduceMotion ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                initial={false}
                key={module.id}
                onClick={() => setActiveIndex(index)}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -45) move(1);
                  if (info.offset.x > 45) move(-1);
                }}
                animate={{
                  x: offset * (mobile ? 82 : compact ? 92 : 118),
                  rotateY: activeCard ? 0 : offset < 0 ? 43 : -43,
                  z: activeCard ? 82 : -distance * 66,
                  scale: activeCard ? 1 : Math.max(0.72, 0.91 - distance * 0.06),
                  opacity: mobile && distance > 1 ? 0 : distance > 3 ? 0 : Math.max(0.2, 1 - distance * 0.23),
                }}
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 26 }}
                style={{ zIndex: 20 - distance }}
                type="button"
              >
                <span className={styles.folio} aria-hidden="true">
                  <span className={styles.spine}>SERES · PRACTITIONER</span>
                  <span className={styles.moduleLabel}>MÓDULO</span>
                  <strong>{String(module.number).padStart(2, "0")}</strong>
                  <span className={styles.coverTitle}>{module.title}</span>
                  <span className={styles.coverFocus}>{module.focus}</span>
                  <i />
                </span>
              </motion.button>
            );
          })}
        </div>

        <button
          aria-label="Módulo siguiente"
          className={styles.arrow}
          data-side="right"
          disabled={activeIndex === programModules.length - 1}
          onClick={() => move(1)}
          type="button"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className={styles.pagination} aria-label="Seleccionar módulo">
        {programModules.map((module, index) => (
          <button
            aria-label={`Ir al módulo ${module.number}`}
            aria-current={index === activeIndex ? "true" : undefined}
            key={module.id}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            {String(module.number).padStart(2, "0")}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={styles.detail}
          exit={{ opacity: 0, y: 8 }}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          key={active.id}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <div>
            <span>{statusLabel[active.status]}</span>
            <h3>{active.title}</h3>
            <p>{active.focus}</p>
          </div>
          <div className={styles.detailMeta}>
            <span><Check size={14} /> Material del programa disponible</span>
            <strong>{active.practiceSlugs.length} {active.practiceSlugs.length === 1 ? "práctica digital" : "prácticas digitales"}</strong>
          </div>
          {active.practiceSlugs.length > 0 ? (
            <Link href={`/learn/experience/${active.practiceSlugs[0]}`}>
              Empezar por una práctica <ArrowRight size={15} />
            </Link>
          ) : (
            <Link href="/learn/experiences">
              Ver prácticas disponibles <ArrowRight size={15} />
            </Link>
          )}
        </motion.div>
      </AnimatePresence>

      <div className={styles.swipeHint}>
        <ArrowLeft size={13} /> Desliza para recorrer los módulos <ArrowRight size={13} />
      </div>
    </section>
  );
}
