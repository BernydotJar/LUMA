import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { PersistentTwinDetail } from "@/components/persistent-twin-detail";

export const metadata: Metadata = {
  title: "Learning Twin persistente · LUMA",
};

export default async function PersistentCoachLearnerPage({
  params,
}: {
  params: Promise<{ learnerId: string }>;
}) {
  const { learnerId } = await params;

  return (
    <AppShell
      mode="studio"
      title="Learning Twin persistente"
      subtitle="Estado, evidencia y siguiente acción desde la misma fuente autoritativa del participante."
    >
      <PersistentTwinDetail learnerId={learnerId} />
    </AppShell>
  );
}
