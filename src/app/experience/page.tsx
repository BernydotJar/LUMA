import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ExperienceConsole } from "@/components/experience-console";

export const metadata: Metadata = {
  title: "Experience Console",
};

export default function ExperiencePage() {
  return (
    <AppShell
      mode="studio"
      title="Experience Console"
      subtitle="Roles, temas, iconografía y modalidades desde una vista de superusuario."
    >
      <ExperienceConsole />
    </AppShell>
  );
}
