import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AcademicOperationsConsole } from "@/components/academic-operations-console";

export const metadata: Metadata = { title: "Programas y clases | LUMA" };

export default function AcademicOperationsPage() {
  return (
    <AppShell mode="studio" title="Programas y clases"
      subtitle="Cohortes, entrenadores y sesiones gestionados desde LUMA.">
      <AcademicOperationsConsole />
      {process.env.LUMA_ASSESSMENT_PUBLICATION_ENABLED === "true" && (
        <section className="content-surface" style={{ borderRadius: 18, padding: 20, marginTop: 24 }}>
          <strong>Publicación institucional de diagnósticos</strong>
          <p style={{ maxWidth: 580, lineHeight: 1.5, margin: "8px 0 14px", color: "var(--muted-strong)" }}>
            Prepara un currículo, solicita revisión independiente y activa versiones aprobadas.
          </p>
          <Link href="/studio/assessments" style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>
            Abrir gestor de assessments institucionales
          </Link>
        </section>
      )}
    </AppShell>
  );
}
