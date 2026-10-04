"use client";

import Link from "next/link";
import { Crown, Moon, Sparkles, Sun, UsersRound } from "lucide-react";
import { useLumaTheme } from "@/components/theme-provider";
import { lumaThemes, type LumaThemeId } from "@/lib/themes";
import styles from "./experience-control.module.css";

const themeIcon = {
  se: Sparkles,
  light: Sun,
  dark: Moon,
} satisfies Record<LumaThemeId, typeof Sun>;

export function ExperienceControl({ mode }: { mode: "learner" | "studio" }) {
  const { theme, setTheme } = useLumaTheme();

  return (
    <div className={styles.control} aria-label="Controles de superusuario">
      <Link className={styles.consoleLink} href="/experience">
        <Crown size={14} />
        <span>Superuser</span>
      </Link>
      <div className={styles.roleSwitch} aria-label="Cambiar experiencia">
        <Link href="/learn" data-active={mode === "learner"}>
          <UsersRound size={14} /> Coachee
        </Link>
        <Link href="/studio" data-active={mode === "studio"}>
          Coach
        </Link>
      </div>
      <div className={styles.themeSwitch} aria-label="Tema visual">
        {lumaThemes.map((item) => {
          const Icon = themeIcon[item.id];
          return (
            <button
              aria-label={`Usar tema ${item.label}`}
              aria-pressed={theme === item.id}
              data-active={theme === item.id}
              key={item.id}
              onClick={() => setTheme(item.id)}
              type="button"
            >
              <Icon size={14} />
              <span>{item.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
