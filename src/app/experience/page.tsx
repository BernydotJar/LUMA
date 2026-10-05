import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ExperienceConsole } from "@/components/experience-console";

export const metadata: Metadata = {
  title: "Consola de experiencia",
};

export default function ExperiencePage() {
  return (
    <AppShell
      mode="studio"
      title="Consola de experiencia"
      subtitle="Roles, temas, iconografía y modalidades desde una vista de superusuario."
    >
      <ExperienceConsole />
    </AppShell>
  );
}
