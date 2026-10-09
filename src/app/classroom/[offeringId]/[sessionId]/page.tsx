import type { Metadata } from "next";
import { LiveClassroom } from "@/components/live-classroom";

export const metadata: Metadata = {
  title: "Aula en vivo",
  robots: { index: false, follow: false },
};

export default async function ClassroomPage({
  params,
}: { params: Promise<{ offeringId: string; sessionId: string }> }) {
  const { offeringId, sessionId } = await params;
  return <LiveClassroom offeringId={offeringId} sessionId={sessionId} />;
}
