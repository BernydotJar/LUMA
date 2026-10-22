import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AssessmentPublicationConsole } from "@/components/assessment-publication-console";

export const metadata: Metadata = { title: "Publicación de assessments | LUMA" };

export default function AssessmentPublicationPage() {
  return (
    <AppShell
      mode="studio"
      title="Publicación académica"
      subtitle="Versiones de diagnóstico, revisión de otro administrador y trazabilidad institucional."
    >
      <AssessmentPublicationConsole />
    </AppShell>
  );
}
