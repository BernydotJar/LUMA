import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { CertificateConsole } from "@/components/certificate-console";

export const metadata: Metadata = { title: "Certificaciones | LUMA" };
export default function StudioCertificatesPage() {
  return (
    <AppShell mode="studio" title="Certificaciones"
      subtitle="Evidencia académica, aprobación responsable y firma electrónica verificable.">
      <CertificateConsole />
    </AppShell>
  );
}
