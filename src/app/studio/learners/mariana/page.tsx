import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { TwinDetail } from "@/components/twin-detail";

export const metadata: Metadata = {
  title: "Coach Intelligence · Mariana",
};

export default function CoachLearnerPage() {
  return (
    <AppShell
      mode="studio"
      title="Coach Intelligence · Mariana"
      subtitle="Learning Twin, evidencia y contexto para la siguiente intervención."
    >
      <TwinDetail />
    </AppShell>
  );
}
