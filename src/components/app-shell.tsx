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
  HelpCircle,
  Home,
  LogOut,
  Search,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import styles from "./app-shell.module.css";

const learnerNavigation = [
  { href: "/learn", label: "Hoy", icon: Home },
  { href: "/twin", label: "Mi Learning Twin", icon: BrainCircuit },
  { href: "/library", label: "Contenido", icon: BookOpen },
  { href: "/learn#journey", label: "Mi ruta", icon: Compass },
];

const studioNavigation = [
  { href: "/studio", label: "Learning Studio", icon: ChartNoAxesCombined },
  { href: "/studio/reflections", label: "Curriculum Reflection", icon: GitBranch },
  { href: "/library", label: "Content Intelligence", icon: BookOpen },
  { href: "/learn", label: "Vista estudiante", icon: Sparkles },
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

  return (
    <div className={styles.shell}>
      <div className="page-noise" />
      <aside className={`${styles.sidebar} glass`}>
        <BrandMark />
        <div className={styles.workspaceLabel}>
          <span>{mode === "studio" ? "Espacio instructor" : "Mi espacio"}</span>
          <strong>{mode === "studio" ? "Practitioner 2026" : "Mariana"}</strong>
        </div>
        <nav className={styles.navigation} aria-label={mode === "studio" ? "Navegación del instructor" : "Navegación de aprendizaje"}>
          {navigation.map(({ href, label, icon: Icon }) => {
            const pathOnly = href.split("#")[0];
            const active = pathname === pathOnly || (pathOnly !== "/learn" && pathname.startsWith(pathOnly));
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
          <Link href="/onboarding"><HelpCircle size={18} /> Recalibrar mi Twin</Link>
          <Link href="/"><LogOut size={18} /> Salir del showcase</Link>
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
            {actions}
            <button className={styles.iconButton} type="button" aria-label="Buscar">
              <Search size={19} />
            </button>
            <button className={styles.iconButton} type="button" aria-label="Notificaciones">
              <Bell size={19} />
              <span className={styles.notificationDot} />
            </button>
            <button className={styles.profileButton} type="button" aria-label="Abrir menú de Mariana">
              <span className={styles.avatar}>M</span>
              <span><strong>Mariana</strong><small>Plan Practitioner</small></span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </section>

      <nav className={`${styles.mobileNav} glass`} aria-label="Navegación móvil">
        {navigation.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const pathOnly = href.split("#")[0];
          const active = pathname === pathOnly || (pathOnly !== "/learn" && pathname.startsWith(pathOnly));
          return (
            <Link href={href} key={href} className={active ? styles.mobileActive : undefined}>
              <Icon size={20} />
              <span>{label.replace("Mi ", "")}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
