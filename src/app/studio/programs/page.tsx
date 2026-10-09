import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AcademicOperationsConsole } from "@/components/academic-operations-console";

export const metadata: Metadata = { title: "Programas y clases | LUMA" };

export default function AcademicOperationsPage() {
  return (
    <AppShell mode="studio" title="Programas y clases"
      subtitle="Cohortes, entrenadores y sesiones gestionados desde LUMA.">
      <AcademicOperationsConsole />
    </AppShell>
  );
}
