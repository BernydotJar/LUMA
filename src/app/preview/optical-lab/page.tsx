import type { Metadata } from "next";
import { OpticalLab } from "@/components/optical-lab";

export const metadata: Metadata = {
  title: "LUMA | Optical Lab v4",
  description: "Isolated Liquid Glass material and SVG refraction showcase.",
  robots: { index: false, follow: false },
};

export default function OpticalLabPage() {
  return <OpticalLab />;
}
