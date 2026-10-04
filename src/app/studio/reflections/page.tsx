import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ReflectionWorkbench } from "@/components/reflection-workbench";

export const metadata: Metadata = {
  title: "Curriculum Reflection",
  description:
    "Inspectable, source-backed knowledge reflection for curriculum intelligence.",
};

export default function CurriculumReflectionPage() {
  return (
    <AppShell
      mode="studio"
      title="Curriculum Reflection"
      subtitle="Conexiones, vacíos y claims revisables con procedencia y control editorial."
    >
      <ReflectionWorkbench />
    </AppShell>
  );
}
