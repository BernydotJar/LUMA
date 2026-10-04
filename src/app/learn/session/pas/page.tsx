import type { Metadata } from "next";
import { PracticeSession } from "@/components/practice-session";

export const metadata: Metadata = { title: "Práctica guiada" };

export default function PracticeSessionPage() {
  return <PracticeSession />;
}
