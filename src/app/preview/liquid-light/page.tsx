import type { Metadata } from "next";
import { LiquidLightProductPreview } from "@/components/liquid-light-product-preview";

export const metadata: Metadata = {
  title: "LUMA · Liquid Light v2 Preview",
  robots: { index: false, follow: false },
};

export default function LiquidLightPreviewPage() {
  return <LiquidLightProductPreview />;
}
