import type { Metadata, Viewport } from "next";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LUMA · Inteligencia de Aprendizaje",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F7" },
    { media: "(prefers-color-scheme: dark)", color: "#24181A" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <ThemeBootstrap />
      </head>
      <body>
        <ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider>
      </body>
    </html>
  );
}
