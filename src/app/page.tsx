import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Flower2 } from "lucide-react";
import { seresDeExcelenciaBrand } from "@/lib/institutions/public-brand";
import styles from "./seres-landing.module.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://luma.lch-app.cloud"),
  title: "Seres de Excelencia · Consciencia y aprendizaje",
  description:
    "Explora tus emociones, creencias y patrones en un espacio de autoconocimiento y aprendizaje de Seres de Excelencia en LUMA.",
  openGraph: {
    title: "Seres de Excelencia en LUMA · Un espacio para conocerte",
    description:
      "Un espacio para reflexionar, aprender y explorar nuevas perspectivas con mayor consciencia.",
    images: [{ url: "/media/seres-violet-hero.webp", width: 2752, height: 1536 }],
    type: "website",
  },
};

const perspectives = [
  {
    title: "Biodescodificación",
    description:
      "Una invitación a reflexionar sobre tus vivencias, emociones y los significados que les das.",
  },
  {
    title: "Biocodificación",
    description:
      "Un espacio para reconocer creencias y explorar nuevas maneras de responder.",
  },
  {
    title: "Consciencia",
    description:
      "Prácticas de observación y aprendizaje para mirar tus patrones con mayor claridad.",
  },
] as const;

export default function HomePage() {
  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <main id="contenido">
        <div className={styles.heroFrame} id="inicio">
          <Image
            src="/media/seres-violet-hero.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay} aria-hidden="true" />

          <header className={styles.header}>
            <Link className={styles.brand} href="/" aria-label="LUMA y Seres de Excelencia, inicio">
              <Flower2 size={30} strokeWidth={1.2} aria-hidden="true" />
              <span className={styles.brandCopy}>
                <strong>LUMA</strong>
                <small>Seres de Excelencia</small>
              </span>
            </Link>
            <nav className={styles.navigation} aria-label="Navegación principal">
              <a href="#enfoque">Nuestro enfoque</a>
              <Link href="/learn">Explorar LUMA</Link>
            </nav>
            <Link className={styles.headerLogin} href="/login">
              Ingresar <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </header>

          <section className={styles.heroContent} aria-labelledby="hero-heading">
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>DE LO INCONSCIENTE A LO CONSCIENTE</span>
              <h1 id="hero-heading">El primer paso es <em>conocerte.</em></h1>
              <p>
                Explora tus emociones, creencias y patrones. Un espacio para
                reflexionar y aprender a tu propio ritmo.
              </p>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="/login">
                  Ingresar a LUMA <ArrowUpRight size={18} aria-hidden="true" />
                </Link>
                <a className={styles.secondaryLink} href="#enfoque">
                  Conocer el enfoque <ArrowDownRight size={17} aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>
        </div>

        <section className={styles.approach} id="enfoque" aria-labelledby="approach-heading">
          <div className={styles.approachIntro}>
            <span className={styles.sectionLabel}>NUESTRO ENFOQUE</span>
            <h2 id="approach-heading">Un espacio para <em>mirar hacia dentro.</em></h2>
            <p>
              Tres perspectivas para explorar tu mundo interior, con curiosidad
              y sin respuestas impuestas.
            </p>
          </div>
          <div className={styles.perspectives}>
            {perspectives.map((perspective, index) => (
              <article className={styles.perspective} key={perspective.title}>
                <span className={styles.number}>0{index + 1}</span>
                <div>
                  <h3>{perspective.title}</h3>
                  <p>{perspective.description}</p>
                </div>
              </article>
            ))}
            <p className={styles.disclaimer}>
              Contenido educativo y de reflexión personal. La biodescodificación
              no es un método médico validado y no sustituye la atención sanitaria
              o psicológica profesional.
            </p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <strong>LUMA</strong>
          <span>para {seresDeExcelenciaBrand.displayName}</span>
        </div>
        <nav aria-label="Enlaces del pie de página">
          <a href="#inicio">Volver arriba</a>
          <Link href="/learn">Explorar</Link>
          <Link href="/login">Ingresar</Link>
        </nav>
        <small>© 2026 LUMA · Seres de Excelencia</small>
      </footer>
    </div>
  );
}
