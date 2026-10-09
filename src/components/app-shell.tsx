"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Award,
  BookOpen,
  BrainCircuit,
  ChartNoAxesCombined,
  GitBranch,
  Compass,
  Crown,
  HelpCircle,
  Home,
  MessageCircle,
  CalendarDays,
  Menu,
  PlayCircle,
  Search,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { AccountMenu } from "@/components/account-menu";
import { ExperienceControl } from "@/components/experience-control";
import styles from "./app-shell.module.css";

const learnerNavigation = [
  { href: "/learn", label: "Hoy", icon: Home },
  { href: "/learn#journey", label: "Ruta", icon: Compass },
  { href: "/learn/experiences", label: "Programa", icon: PlayCircle },
  { href: "/learn/certificates", label: "Certificados", icon: Award },
  { href: "/learn#luma", label: "LUMA", icon: MessageCircle },
];

const studioNavigation = [
  { href: "/experience", label: "Mi experiencia", icon: Crown },
  { href: "/studio", label: "Estudio del entrenador", icon: ChartNoAxesCombined },
  { href: "/studio/class-intelligence", label: "Objetivos de aprendizaje", icon: BrainCircuit },
  { href: "/studio/certificates", label: "Certificaciones", icon: Award },
  { href: "/studio/programs", label: "Programas y clases", icon: CalendarDays },
  { href: "/studio/enrollments", label: "Matrículas", icon: UserPlus },
  { href: "/library", label: "Inteligencia de contenido", icon: BookOpen },
  { href: "/studio/reflections", label: "Actualizaciones de contenido", icon: GitBranch },
  { href: "/learn", label: "Vista participante", icon: Sparkles },
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
  // The learner's LUMA assistant must stay visible on mobile.
  // Secondary destinations are accessible via "Más", never silently removed.
  const mobilePrimary = studio
    ? [studioNavigation[1], studioNavigation[2], studioNavigation[3]]
    : [learnerNavigation[0], learnerNavigation[1], learnerNavigation[2], learnerNavigation[4]];
  const mobileSecondary = navigation.filter(
    (item) => !mobilePrimary.some((primary) => primary.href === item.href),
  );

  return (
    <div className={styles.shell} data-mode={mode}>
      <div className="page-noise" />
      <aside className={`${styles.sidebar} glass`}>
        <BrandMark />
        <div className={styles.workspaceLabel}>
          <span>{studio ? "Inteligencia del entrenador" : "Ruta activa"}</span>
          <strong>{studio ? "Practitioner 2026" : "Practitioner · Poder"}</strong>
        </div>
        <nav
          className={styles.navigation}
          aria-label={studio ? "Navegación del entrenador" : "Navegación de aprendizaje"}
        >
          {navigation.map(({ href, label, icon: Icon }) => {
            const pathOnly = href.split("#")[0];
            const hasHash = href.includes("#");
            const active =
              !hasHash &&
              (pathname === pathOnly ||
                (pathOnly !== "/learn" && pathname.startsWith(pathOnly)));
            return (
              <Link href={href} key={href} aria-label={label} className={active ? styles.activeNav : undefined}>
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
                {active && <span className={styles.activeDot} />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarBottom}>
          {studio ? (
            <Link href="/learn" aria-label="Abrir vista participante"><Sparkles size={18} /> Abrir vista participante</Link>
          ) : (
            <Link href="/onboarding" aria-label="Ajustar mi perfil"><HelpCircle size={18} /> Ajustar mi perfil</Link>
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
            <AccountMenu mode={mode} />
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </section>

      <nav className={`${styles.mobileNav} glass`} data-mode={mode} aria-label="Navegación móvil">
        {mobilePrimary.map(({ href, label, icon: Icon }) => {
          const pathOnly = href.split("#")[0];
          const hasHash = href.includes("#");
          const active =
            !hasHash &&
            (pathname === pathOnly ||
              (pathOnly !== "/learn" && pathname.startsWith(pathOnly)));
          return (
            <Link href={href} key={href} aria-label={label} className={active ? styles.mobileActive : undefined}>
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
        <details className={styles.mobileMore}>
          <summary aria-label="Más secciones">
            <Menu size={20} aria-hidden="true" />
            <span>Más</span>
          </summary>
          <div className={styles.mobileMoreMenu} aria-label="Otras secciones">
            {mobileSecondary.map(({ href, label, icon: Icon }) => (
              <Link href={href} key={href} aria-label={label}>
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </details>
      </nav>
    </div>
  );
}
