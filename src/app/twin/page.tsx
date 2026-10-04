import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { TwinDetail } from "@/components/twin-detail";

export const metadata: Metadata = { title: "Mi Learning Twin" };

export default function TwinPage() {
  return (
    <AppShell title="Mi Learning Twin" subtitle="Evidencia, inferencias y trayectoria de aprendizaje.">
      <TwinDetail />
    </AppShell>
  );
}
