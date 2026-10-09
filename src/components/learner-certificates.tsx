"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "@firebase/auth";
import Link from "next/link";
import { Award, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase-client";
import { certificateApi } from "@/lib/certificates/client";
import styles from "./learner-certificates.module.css";

interface LearnerCertificate {
  certificateId: string;
  programTitle: string;
  issuerLegalName: string;
  status: "signed" | "revoked";
  issuedAt: string;
  signedAt: string | null;
}

export function LearnerCertificates() {
  const [accountUid, setAccountUid] = useState<string | null | undefined>(undefined);
  const [certificates, setCertificates] = useState<LearnerCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(firebaseAuth, user => {
    setAccountUid(user?.uid ?? null);
    setCertificates([]);
    setError("");
    setLoading(Boolean(user));
  }), []);
  useEffect(() => {
    if (!accountUid) return;
    let cancelled = false;
    void certificateApi<{ certificates: LearnerCertificate[] }>("/api/certificates/mine")
      .then(data => { if (!cancelled) setCertificates(data.certificates); })
      .catch(() => { if (!cancelled) setError("No fue posible consultar tus certificados."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountUid]);

  async function download(id: string) {
    const user = firebaseAuth.currentUser;
    if (!user || user.uid !== accountUid) return;
    setDownloading(id);
    try {
      const response = await fetch(
        `/api/certificates/${encodeURIComponent(id)}/download`, {
        cache: "no-store",
        headers: { authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) throw new Error("download_failure");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `certificado-luma-${id}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch { setError("No fue posible descargar el documento firmado."); }
    finally { setDownloading(null); }
  }

  return <div className={styles.layout}>
    <section className={styles.header}>
      <div className={styles.emblem}><Award size={26}/></div>
      <div><span className="eyebrow">LOGROS VERIFICABLES</span>
        <h2>Una evidencia que permanece contigo.</h2>
        <p>Consulta tus certificaciones, descarga el documento firmado y comparte su verificación institucional.</p></div>
    </section>
    {accountUid === null && <p>Inicia sesión para ver tus credenciales.</p>}
    {Boolean(accountUid) && loading && <p role="status">Consultando credenciales…</p>}
    {accountUid && error && <p role="alert">{error}</p>}
    {accountUid && !loading && !error && certificates.length === 0 &&
      <section className={styles.empty}><ShieldCheck size={28}/>
        <h3>Tus certificados aparecerán aquí.</h3>
        <p>Cuando el entrenador apruebe tu finalización y la institución complete su firma, la credencial estará disponible.</p>
      </section>}
    {accountUid && <div className={styles.grid}>
      {certificates.map(item => <article className={styles.card} key={item.certificateId}>
        <span className={styles.icon}><Award size={24}/></span>
        <div className={styles.status} data-revoked={item.status === "revoked"}>
          {item.status === "revoked" ? "Revocado" : "Firmado y verificado"}</div>
        <h3>{item.programTitle}</h3>
        <p>{item.issuerLegalName}</p>
        <small>Emitido el {new Date(item.issuedAt).toLocaleDateString("es")}</small>
        <div className={styles.actions}>
          {item.status === "signed" && <button className="button-primary" type="button"
            disabled={downloading !== null} onClick={() => void download(item.certificateId)}>
            <Download size={16}/> {downloading === item.certificateId ? "Preparando…" : "Descargar PDF"}
          </button>}
          <Link className="button-secondary" href={`/verify/${encodeURIComponent(item.certificateId)}`}
            target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Verificar</Link>
        </div>
      </article>)}
    </div>}
  </div>;
}
