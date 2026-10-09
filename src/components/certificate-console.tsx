"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "@firebase/auth";
import { Award, BookCheck, CheckCircle2, FileSignature, ShieldCheck, ArrowRight } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase-client";
import { certificateApi, type CertificateLearnerRow, type CertificateOfferingOption } from "@/lib/certificates/client";
import styles from "./certificate-console.module.css";

type OfferingResponse = { offerings: CertificateOfferingOption[] };
type LearnerResponse = {
  offering: { title: string };
  learners: CertificateLearnerRow[];
  nextCursor: string | null;
};

function errorText(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const translation: Record<string, string> = {
    certificate_enrollment_required: "Esta persona no tiene una matrícula activa en la cohorte.",
    certificate_verified_learner_identity_required: "Se requiere el nombre y el correo verificado del participante.",
    certificate_issuer_not_configured: "Configura el emisor y su firmante autorizado antes de solicitar la firma.",
    certificate_configuration_required: "Faltan configuraciones de firma o almacenamiento en el entorno.",
    certificate_completion_required: "Primero registra y aprueba la finalización académica.",
    certificate_completion_already_approved: "Esta evaluación ya fue aprobada y conserva su evidencia original.",
  };
  return translation[code] ?? code ?? "No fue posible completar esta operación.";
}

export function CertificateConsole() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [accountUid, setAccountUid] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [offerings, setOfferings] = useState<CertificateOfferingOption[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [learners, setLearners] = useState<CertificateLearnerRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [rationale, setRationale] = useState("");
  const [legalName, setLegalName] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState<null | {
    status: "preparing" | "pending_signature" | "signed" | "failed" | "revoked";
    signedAt: string | null; verificationUrl: string | null;
  }>(null);
  const [issuer, setIssuer] = useState({ legalName: "", signerName: "", signerEmail: "" });

  useEffect(() => onAuthStateChanged(firebaseAuth, user => {
    setAuthenticated(Boolean(user));
    setAccountUid(user?.uid ?? null);
    setAdmin(false);
    setOfferings([]);
    setOfferingId("");
    setSelectedId("");
    setLearners([]);
    setNextCursor(null);
    setCertificateStatus(null);
    setMessage("");
    setRationale("");
    setLegalName("");
    setIdentityConfirmed(false);
    setIssuer({ legalName: "", signerName: "", signerEmail: "" });
    if (user) void user.getIdTokenResult().then(result => {
      if (firebaseAuth.currentUser?.uid !== user.uid) return;
      setAdmin(result.claims.admin === true || result.claims.superuser === true ||
        result.claims.role === "admin" || result.claims.role === "superuser");
    }).catch(() => setAdmin(false));
  }), []);

  useEffect(() => {
    if (!accountUid) return;
    let cancelled = false;
    void certificateApi<OfferingResponse>("/api/certificates/console")
      .then(data => { if (!cancelled) setOfferings(data.offerings); })
      .catch(error => { if (!cancelled) setMessage(errorText(error)); });
    return () => { cancelled = true; };
  }, [accountUid]);

  useEffect(() => {
    if (!offeringId || !accountUid) return;
    let cancelled = false;
    void certificateApi<LearnerResponse>(
      `/api/certificates/console?offeringId=${encodeURIComponent(offeringId)}`,
    ).then(data => {
      if (cancelled) return;
      setLearners(data.learners);
      setNextCursor(data.nextCursor);
    }).catch(error => { if (!cancelled) setMessage(errorText(error)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [accountUid, offeringId, revision]);

  const selected = learners.find(row => row.learnerId === selectedId);
  useEffect(() => {
    if (!selected?.certificateId || !accountUid) return;
    let cancelled = false;
    void certificateApi<{ certificate: {
      status: "preparing" | "pending_signature" | "signed" | "failed" | "revoked";
      signedAt: string | null; verificationUrl: string | null;
    } }>(`/api/certificates/${encodeURIComponent(selected.certificateId)}`)
      .then(data => { if (!cancelled) setCertificateStatus(data.certificate); })
      .catch(() => { if (!cancelled) setMessage("No fue posible consultar el estado de firma."); });
    return () => { cancelled = true; };
  }, [selected?.certificateId, accountUid, revision]);
  async function advance(action: "approve" | "issue") {
    if (!selected || !offeringId) return;
    setBusy(true);
    setMessage("");
    try {
      if (action === "approve") {
        await certificateApi("/api/certificates/completions", {
          method: "POST", body: {
            offeringId, learnerId: selected.learnerId, rationale,
            learnerLegalName: legalName, identityConfirmed, evidenceEventIds: [],
          },
        });
        setMessage("Finalización aprobada y registrada con evidencia de la decisión.");
      } else {
        await certificateApi("/api/certificates", {
          method: "POST",
          body: { offeringId, learnerId: selected.learnerId },
        });
        setMessage("Solicitud enviada al firmante autorizado. El certificado será válido cuando la firma se complete y se archive.");
        setConfirmIssue(false);
      }
      setRevision(value => value + 1);
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }

  async function configureIssuer() {
    const selectedOffering = offerings.find(item => item.offeringId === offeringId);
    if (!selectedOffering) return;
    setBusy(true);
    try {
      await certificateApi("/api/certificates/issuers", {
        method: "PUT", body: { tenantId: selectedOffering.tenantId, ...issuer },
      });
      setMessage("Emisor institucional y firmante autorizado configurados.");
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }

  async function loadMore() {
    if (!nextCursor || busy) return;
    setBusy(true);
    try {
      const data = await certificateApi<LearnerResponse>(
        `/api/certificates/console?offeringId=${encodeURIComponent(offeringId)}&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setLearners(current => [...current, ...data.learners]);
      setNextCursor(data.nextCursor);
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  }

  return <div className={styles.layout}>
    <section className={styles.intro}>
      <div className={styles.icon}><Award size={26} /></div>
      <div>
        <span className="eyebrow">CREDENCIALES VERIFICABLES</span>
        <h2>La finalización se demuestra. La certificación se autoriza.</h2>
        <p>Cada credencial conserva quién aprobó el aprendizaje, a qué cohorte pertenece y quién firmó el documento.</p>
      </div>
    </section>

    {authenticated === false && <section className="content-surface">
      <p>Inicia sesión con una cuenta de entrenador autorizada para gestionar certificados.</p>
    </section>}

    {authenticated && <>
      <section className={styles.panel}>
        <label htmlFor="cert-offering">Programa y cohorte</label>
        <select id="cert-offering" value={offeringId} onChange={event => {
          setOfferingId(event.target.value); setSelectedId(""); setLoading(true); setRationale(""); setLegalName(""); setIdentityConfirmed(false);
          setConfirmIssue(false); setCertificateStatus(null); setMessage(""); setLearners([]);
        }}>
          <option value="">Selecciona una cohorte autorizada</option>
          {offerings.map(option => <option key={option.offeringId} value={option.offeringId}>
            {option.title} · {option.cohortKey}
          </option>)}
        </select>
        <p>Solo aparecen cohortes dentro de tu alcance de entrenador o administración.</p>
      </section>

      {offeringId && <div className={styles.twoColumn}>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}><BookCheck size={19} /><h3>Participantes matriculados</h3></div>
          {loading ? <p>Consultando matrículas…</p> : learners.length === 0 ?
            <p>No se encontraron matrículas activas en esta cohorte.</p> :
            <div className={styles.learnerList}>
              {learners.map(learner => <button type="button" key={learner.learnerId}
                className={styles.learner} data-selected={selectedId === learner.learnerId}
                onClick={() => { setSelectedId(learner.learnerId); setRationale(""); setLegalName(""); setIdentityConfirmed(false); setConfirmIssue(false); setCertificateStatus(null); setMessage(""); }}>
                <span><strong>{learner.name}</strong>
                  <small>{learner.certificateId ? "Certificación iniciada" :
                    learner.approvedAt ? "Finalización aprobada" :
                    learner.identityReady ? "Requiere evaluación" : "Correo no verificado"}</small></span>
                <ArrowRight size={16} />
              </button>)}
              {nextCursor && <button type="button" className="button-secondary"
                disabled={busy} onClick={() => void loadMore()}>Ver más participantes</button>}
            </div>}
        </section>
        <section className={styles.panel}>
          <div className={styles.sectionTitle}><ShieldCheck size={19} /><h3>Evaluación y emisión</h3></div>
          {!selected ? <p>Selecciona un participante para revisar y registrar su finalización.</p> :
            <>
              <h3>{selected.name}</h3>
              {!selected.identityReady && <p className={styles.warning}>
                La cuenta necesita un correo verificado. El nombre legal debe ser confirmado por el entrenador durante la evaluación.</p>}
              {selected.approvedAt ? <div className={styles.approved}><CheckCircle2 size={17} />
                Finalización aprobada el {new Date(selected.approvedAt).toLocaleDateString("es")}</div> :
                <>
                  <label htmlFor="cert-legal-name">Nombre legal confirmado con los registros institucionales</label>
                  <input id="cert-legal-name" type="text" maxLength={120}
                    autoComplete="off" value={legalName}
                    placeholder="Nombre completo que figurará en el certificado"
                    onChange={event => setLegalName(event.target.value)} />
                  <label className={styles.attestation}>
                    <input type="checkbox" checked={identityConfirmed}
                      onChange={event => setIdentityConfirmed(event.target.checked)} />
                    <span>He contrastado el nombre y la identidad del participante con los registros
                      institucionales autorizados y asumo la responsabilidad de esta certificación.</span>
                  </label>
                  <label htmlFor="cert-rationale">Justificación académica y evidencia revisada</label>
                  <textarea id="cert-rationale" rows={6} maxLength={2000} value={rationale}
                    placeholder="Describe competencias demostradas, actividades revisadas y criterio aplicado. Mínimo 40 caracteres."
                    onChange={event => setRationale(event.target.value)} />
                  <button type="button" className="button-primary"
                    disabled={busy || rationale.trim().length < 40 || legalName.trim().length < 4 || !identityConfirmed}
                    onClick={() => void advance("approve")}>Aprobar finalización</button>
                </>}
              {selected.approvedAt && !selected.certificateId && selected.identityReady &&
                (!confirmIssue ? <button type="button" className="button-primary"
                    disabled={busy} onClick={() => setConfirmIssue(true)}>
                    <FileSignature size={16} /> Preparar y enviar a firma</button>
                  : <div className={styles.confirm}>
                    <strong>Confirmar solicitud de firma</strong>
                    <p>El firmante autorizado recibirá un documento real para firmar electrónicamente. Esta acción no es una vista previa.</p>
                    <button type="button" className="button-primary" disabled={busy}
                      onClick={() => void advance("issue")}>Confirmar envío</button>
                    <button type="button" className="button-secondary"
                      onClick={() => setConfirmIssue(false)}>Cancelar</button>
                  </div>)}
              {selected.certificateId && <div className={styles.confirm}>
                <strong>Estado de certificación</strong>
                <p>{certificateStatus === null ? "Consultando firma…" :
                  certificateStatus.status === "signed" ? "Certificado firmado, archivado y verificable." :
                  certificateStatus.status === "revoked" ? "Certificado revocado: ya no es válido." :
                  certificateStatus.status === "failed" ? "La firma requiere conciliación administrativa. No se emitirá automáticamente otra solicitud." :
                  certificateStatus.status === "pending_signature" ? "Enviado a la institución. Pendiente de firma electrónica." :
                  "Preparando la solicitud de firma."}</p>
                {certificateStatus?.verificationUrl && <Link className="button-secondary"
                  href={certificateStatus.verificationUrl} target="_blank"
                  rel="noopener noreferrer">Abrir verificación pública <ArrowRight size={15} /></Link>}
              </div>}
            </>}
        </section>
      </div>}

      {admin && offeringId && <details className={styles.panel}>
        <summary>Administración · Emisor y firmante institucional</summary>
        <p>Configura únicamente personas y entidades que hayan autorizado expresamente la firma de certificados.</p>
        <div className={styles.fields}>
          <label>Razón social del emisor <input value={issuer.legalName}
            onChange={event => setIssuer(current => ({ ...current, legalName: event.target.value }))} /></label>
          <label>Nombre del firmante <input value={issuer.signerName}
            onChange={event => setIssuer(current => ({ ...current, signerName: event.target.value }))} /></label>
          <label>Correo del firmante <input type="email" value={issuer.signerEmail}
            onChange={event => setIssuer(current => ({ ...current, signerEmail: event.target.value }))} /></label>
        </div>
        <button type="button" className="button-secondary" disabled={busy ||
          !issuer.legalName || !issuer.signerName || !issuer.signerEmail}
          onClick={() => void configureIssuer()}>Guardar configuración del emisor</button>
      </details>}
    </>}
    {message && <p className={styles.feedback} role="status">{message}</p>}
  </div>;
}
