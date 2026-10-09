import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ExperienceConsole } from "@/components/experience-console";

export const metadata: Metadata = {
  title: "Configuración de experiencia",
};

export default function ExperiencePage() {
  return (
    <AppShell
      mode="studio"
      title="Configuración de experiencia"
      subtitle="Personaliza la apariencia y accede a las herramientas de aprendizaje y acompañamiento."
    >
      <ExperienceConsole />
    </AppShell>
  );
}
