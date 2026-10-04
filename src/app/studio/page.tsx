import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { StudioDashboard } from "@/components/studio-dashboard";

export const metadata: Metadata = { title: "Learning Studio" };

export default function StudioPage() {
  return (
    <AppShell mode="studio" title="Learning Studio" subtitle="¿Está enseñando el curso—y a quién necesita ayudar?">
      <StudioDashboard />
    </AppShell>
  );
}
