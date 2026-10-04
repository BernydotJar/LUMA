import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { IconographyCatalog } from "@/components/iconography-catalog";

export const metadata: Metadata = {
  title: "Iconografía LUMA",
};

export default function IconographyPage() {
  return (
    <AppShell
      mode="studio"
      title="Iconografía LUMA"
      subtitle="Semántica estable, materiales por tema y motion detrás de aprobación."
    >
      <IconographyCatalog />
    </AppShell>
  );
}
