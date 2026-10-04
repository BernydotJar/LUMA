import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StudioDashboard } from "@/components/studio-dashboard";

export const metadata: Metadata = { title: "Coach Studio" };

export default function StudioPage() {
  return (
    <AppShell mode="studio" title="Coach Studio" subtitle="Qué está funcionando, dónde intervenir y qué evidencia sostiene cada decisión.">
      <StudioDashboard />
    </AppShell>
  );
}
