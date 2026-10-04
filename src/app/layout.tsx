import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LUMA · Learning Intelligence",
    template: "%s · LUMA",
  },
  description:
    "LUMA convierte conocimiento experto en aprendizaje individualizado y medible.",
  applicationName: "LUMA",
  category: "education",
  icons: {
    icon: "/luma-mark.svg",
    apple: "/luma-mark.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#07120f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
