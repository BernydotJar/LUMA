import type { Metadata } from "next";
import { OnboardingExperience } from "@/components/onboarding-experience";

export const metadata: Metadata = {
  title: "Configura tu experiencia",
};

export default function OnboardingPage() {
  return <OnboardingExperience />;
}
