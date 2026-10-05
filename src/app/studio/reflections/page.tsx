import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ReflectionWorkbench } from "@/components/reflection-workbench";

export const metadata: Metadata = {
  title: "Reflexión curricular",
  description:
    "Inspectable, source-backed knowledge reflection for curriculum intelligence.",
};

export default function CurriculumReflectionPage() {
  return (
    <AppShell
      mode="studio"
      title="Reflexión curricular"
      subtitle="Conexiones, vacíos y afirmaciones revisables con procedencia y control editorial."
    >
      <ReflectionWorkbench />
    </AppShell>
  );
}
