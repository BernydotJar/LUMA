import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { LearnerCertificates } from "@/components/learner-certificates";

export const metadata: Metadata = { title: "Mis certificados | LUMA" };
export default function MyCertificatesPage() {
  return <AppShell mode="learner" title="Mis certificados"
    subtitle="Tus logros, respaldados por una credencial académica verificable.">
    <LearnerCertificates />
  </AppShell>;
}
