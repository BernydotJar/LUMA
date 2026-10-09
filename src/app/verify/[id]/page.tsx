import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, BadgeCheck, BadgeX, ShieldCheck } from "lucide-react";
import { certificates } from "@/lib/certificates/server";
import { documentId, publicCertificateState } from "@/lib/certificates/domain";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Verificación de certificado | LUMA",
  robots: { index: false, follow: false },
};
export default async function VerifyPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let certificateId: string;
  try { certificateId = documentId(id, "certificate_id"); }
  catch { notFound(); }
  const record = await certificates.get(certificateId);
  const verification = record ? publicCertificateState(record) : null;
  if (!verification) notFound();
  const valid = verification.status === "valid";
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}><Award size={28} /> LUMA <span>· Learning Intelligence</span></div>
        <div className={styles.divider} />
        <div className={styles.status} data-valid={valid}>
          {valid ? <BadgeCheck size={25} /> : <BadgeX size={25} />}
          {valid ? "Certificado verificado" : "Certificado revocado"}
        </div>
        <h1>{verification.learnerName}</h1>
        <p className={styles.desc}>
          {valid ? "La firma electrónica del emisor fue registrada y el documento firmado se encuentra archivado."
            : "Esta credencial fue revocada por la institución emisora y ya no es válida."}
        </p>
        <dl className={styles.details}>
          <div><dt>Programa</dt><dd>{verification.programTitle}</dd></div>
          <div><dt>Institución emisora</dt><dd>{verification.issuerLegalName}</dd></div>
          <div><dt>Fecha de emisión</dt><dd>{verification.issuedAt.slice(0, 10)}</dd></div>
          <div><dt>Firma completada</dt><dd>{verification.signedAt?.slice(0, 10) || "—"}</dd></div>
          <div><dt>ID de certificado</dt><dd className={styles.code}>{verification.certificateId}</dd></div>
          <div><dt>Huella SHA-256 del PDF firmado</dt><dd className={styles.code}>{verification.signedSha256 || "—"}</dd></div>
        </dl>
        <p className={styles.note}><ShieldCheck size={17} />
          La página verifica el registro institucional. Para evaluar el nivel jurídico de la firma,
          revisa también el documento firmado y el certificado de finalización del proveedor.</p>
        <Link href="/" className={styles.link}>Ir a LUMA</Link>
      </section>
    </main>
  );
}
