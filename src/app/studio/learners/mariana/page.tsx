import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { TwinDetail } from "@/components/twin-detail";

export const metadata: Metadata = {
  title: "Inteligencia del entrenador · Mariana",
};

export default function CoachLearnerPage() {
  return (
    <AppShell
      mode="studio"
      title="Inteligencia del entrenador · Mariana"
      subtitle="Gemelo de aprendizaje, evidencia y contexto para la siguiente intervención."
    >
      <TwinDetail />
    </AppShell>
  );
}
