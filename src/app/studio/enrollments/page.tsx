import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { InstitutionalEnrollmentConsole } from "@/components/institutional-enrollment-console";

export const metadata: Metadata = { title: "Matrículas institucionales | LUMA" };

export default function StudioEnrollmentPage() {
  return (
    <AppShell mode="studio" title="Matrículas institucionales"
      subtitle="Acceso administrado con trazabilidad, vigencia y revocación, sin simular compras.">
      <InstitutionalEnrollmentConsole />
    </AppShell>
  );
}
