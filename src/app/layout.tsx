import type { Metadata, Viewport } from "next";
import { ThemeBootstrap } from "@/components/theme-bootstrap";
import { AuthProvider } from "@/components/auth-provider";
import { QaEmulatorAuth } from "@/components/qa-emulator-auth";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import "@livekit/components-styles";

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
        <ThemeProvider><AuthProvider>
          {process.env.NODE_ENV === "development" &&
           process.env.NEXT_PUBLIC_LUMA_QA_FIREBASE_PROJECT?.startsWith("demo-") &&
           process.env.NEXT_PUBLIC_LUMA_QA_AUTH_EMULATOR_URL === "http://127.0.0.1:9099" && <QaEmulatorAuth />}
          {children}
        </AuthProvider></ThemeProvider>
      </body>
    </html>
  );
}
