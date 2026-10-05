import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StudioDashboard } from "@/components/studio-dashboard";

export const metadata: Metadata = { title: "Estudio del entrenador" };

export default function StudioPage() {
  return (
    <AppShell mode="studio" title="Estudio del entrenador" subtitle="Qué está funcionando, dónde intervenir y qué evidencia sostiene cada decisión.">
      <StudioDashboard />
    </AppShell>
  );
}
