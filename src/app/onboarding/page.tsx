import type { Metadata } from "next";
import { OnboardingExperience } from "@/components/onboarding-experience";

export const metadata: Metadata = {
  title: "Construye tu Learning Twin",
};

export default function OnboardingPage() {
  return <OnboardingExperience />;
}
