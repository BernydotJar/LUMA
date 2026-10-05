"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  BrainCircuit,
  ChartNoAxesCombined,
  ChevronDown,
  GitBranch,
  Compass,
  Crown,
  HelpCircle,
  Home,
  MessageCircle,
  PlayCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ExperienceControl } from "@/components/experience-control";
import styles from "./app-shell.module.css";

const learnerNavigation = [
  { href: "/learn", label: "Hoy", icon: Home },
  { href: "/learn#journey", label: "Journey", icon: Compass },
  { href: "/learn/experiences", label: "Práctica", icon: PlayCircle },
  { href: "/learn#luma", label: "LUMA", icon: MessageCircle },
];

const studioNavigation = [
  { href: "/experience", label: "Experience Console", icon: Crown },
  { href: "/studio", label: "Coach Studio", icon: ChartNoAxesCombined },
  { href: "/studio/learners/mariana", label: "Learning Twin", icon: BrainCircuit },
  { href: "/library", label: "Content Intelligence", icon: BookOpen },
  { href: "/studio/reflections", label: "Curriculum Reflection", icon: GitBranch },
  { href: "/learn", label: "Vista coachee", icon: Sparkles },
];

export function AppShell({
  children,
  mode = "learner",
  title,
  subtitle,
  actions,
}: {
  children: React.ReactNode;
  mode?: "learner" | "studio";
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const navigation = mode === "studio" ? studioNavigation : learnerNavigation;
  const studio = mode === "studio";

  return (
    <div className={styles.shell} data-mode={mode}>
      <div className="page-noise" />
      <aside className={`${styles.sidebar} glass`}>
        <BrandMark />
        <div className={styles.workspaceLabel}>
          <span>{studio ? "Coach intelligence" : "Journey activo"}</span>
          <strong>{studio ? "Practitioner 2026" : "Practitioner · Poder"}</strong>
        </div>
        <nav
          className={styles.navigation}
          aria-label={studio ? "Navegación del coach" : "Navegación de aprendizaje"}
        >
          {navigation.map(({ href, label, icon: Icon }) => {
            const pathOnly = href.split("#")[0];
            const hasHash = href.includes("#");
            const active =
              !hasHash &&
              (pathname === pathOnly ||
                (pathOnly !== "/learn" && pathname.startsWith(pathOnly)));
            return (
              <Link href={href} key={href} className={active ? styles.activeNav : undefined}>
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <span className={styles.activeDot} />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          {studio ? (
            <Link href="/learn"><Sparkles size={18} /> Abrir vista coachee</Link>
          ) : (
            <Link href="/onboarding"><HelpCircle size={18} /> Ajustar mi perfil</Link>
          )}
        </div>
      </aside>

      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.pageTitle}>
            <span className={styles.mobileBrand}><BrandMark compact /></span>
            <div>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </div>
          <div className={styles.topbarActions}>
            <ExperienceControl mode={mode} />
            {actions}
            <button className={styles.iconButton} type="button" aria-label="Buscar">
              <Search size={19} />
            </button>
            <button className={styles.iconButton} type="button" aria-label="Notificaciones">
              <Bell size={19} />
              <span className={styles.notificationDot} />
            </button>
            <button
              className={styles.profileButton}
              type="button"
              aria-label={studio ? "Abrir menú del coach" : "Abrir menú de Mariana"}
            >
              <span className={styles.avatar}>{studio ? "C" : "M"}</span>
              <span>
                <strong>{studio ? "Coach" : "Mariana"}</strong>
                <small>{studio ? "Vista interna" : "Plan Practitioner"}</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </section>

      <nav className={`${styles.mobileNav} glass`} aria-label="Navegación móvil">
        {navigation.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const pathOnly = href.split("#")[0];
          const hasHash = href.includes("#");
          const active =
            !hasHash &&
            (pathname === pathOnly ||
              (pathOnly !== "/learn" && pathname.startsWith(pathOnly)));
          return (
            <Link href={href} key={href} className={active ? styles.mobileActive : undefined}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
