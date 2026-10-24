"use client";
import { useEffect, useState } from "react";
import { Check, ClipboardCopy, ExternalLink, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { useLumaAuth } from "@/components/auth-provider";
import type { AcademyApplicationRecord } from "@/lib/institutions/application";
import type { OperatorDecision } from "@/lib/institutions/approval-policy";
import styles from "./review.module.css";

type ListResponse = { applications: AcademyApplicationRecord[]; nextCursor: string | null };
type OperatorResult = { application: AcademyApplicationRecord; oneTimeToken?: string; auditId: string; expiresAt?: string };
const initialReason = "Identidad institucional evaluada mediante proceso de revisión documentado.";
const labels: Record<AcademyApplicationRecord["status"], string> = {
  received: "Recibida", in_review: "En revisión", invitation_pending: "Invitación pendiente",
  invitation_accepted: "Invitación aceptada", activated: "Activada", rejected: "Rechazada",
};
const modality: Record<AcademyApplicationRecord["deliveryMode"], string> = {
  live: "En vivo", evergreen: "A tu ritmo", hybrid: "Híbrida",
};

export default function InstitutionApplicationsInbox() {
  const { user, loading } = useLumaAuth();
  const [rows, setRows] = useState<AcademyApplicationRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [reason, setReason] = useState(initialReason);
  const [tenantId, setTenantId] = useState("");
  const [programId, setProgramId] = useState("");
  const [oneTimeLink, setOneTimeLink] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [revision, setRevision] = useState(0);
  const current = rows.find(r => r.applicationId === selected);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void user.getIdToken().then(token => fetch("/api/platform/institution-applications?limit=30", {
      headers: { authorization: `Bearer ${token}` }, cache: "no-store",
    })).then(async result => {
      if (!active) return;
      if (result.status === 401 || result.status === 403 || result.status === 503) {
        setAuthorized(false); return;
      }
      if (!result.ok) throw Error("inbox_unavailable");
      const data = await result.json() as ListResponse;
      if (active) { setAuthorized(true); setRows(data.applications); setCursor(data.nextCursor); }
    }).catch(() => { if (active) setNotice("No se pudo consultar la bandeja. Reintenta más tarde."); });
    return () => { active = false; };
  }, [user, revision]);

  async function more() {
    if (!user || !cursor || busy) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/platform/institution-applications?limit=30&cursor=${cursor}`, {
        headers: { authorization: `Bearer ${token}` }, cache: "no-store",
      });
      if (!response.ok) throw Error("page_unavailable");
      const data = await response.json() as ListResponse;
      setRows(previous => [...previous, ...data.applications]); setCursor(data.nextCursor);
    } catch { setNotice("No se pudo cargar la siguiente página."); }
    finally { setBusy(false); }
  }

  async function bootstrap() {
    if (!user || !current || busy || current.status !== "activated") return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/platform/institution-applications/${current.applicationId}/bootstrap`, {
        method: "POST", cache: "no-store",
        headers: { authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID().replaceAll("-", "") }),
      });
      if (!response.ok) throw Error((await response.json() as {error?:string}).error || "bootstrap_failed");
      setNotice("Borrador institucional creado. El administrador puede entrar a Primer curso y configurar su academia.");
    } catch (error) {
      setNotice(error instanceof Error ? `No se inicializó el borrador: ${error.message}` : "Error de configuración.");
    } finally { setBusy(false); }
  }

  async function decide(action: OperatorDecision["action"]) {
    if (!user || !current || busy) return;
    setBusy(true); setOneTimeLink(""); setNotice("");
    try {
      const data: OperatorDecision = action === "screen"
        ? { action, expectedStatus: "received", tenantId, initialProgramId: programId, reason }
        : action === "invite" ? { action, expectedStatus: "in_review", reason }
        : action === "reissue" ? { action, expectedStatus: "invitation_pending", reason }
        : action === "revoke_invitation" ? { action, expectedStatus: "invitation_pending", reason }
        : { action: "reject", expectedStatus: current.status as "received" | "in_review" | "invitation_pending" | "invitation_accepted", reason };
      const response = await fetch(`/api/platform/institution-applications/${current.applicationId}/decisions`, {
        method: "POST", headers: { authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json" }, body: JSON.stringify(data), cache: "no-store",
      });
      if (!response.ok) {
        const error = await response.json() as { error?: string };
        throw Error(error.error || "decision_unavailable");
      }
      const result = await response.json() as OperatorResult;
      setRows(previous => previous.map(item => item.applicationId === current.applicationId ? result.application : item));
      if (result.oneTimeToken) {
        const proof = new URLSearchParams({ app: current.applicationId, token: result.oneTimeToken });
        setOneTimeLink(`${window.location.origin}/academia/invitacion#${proof.toString()}`);
        setNotice("Invitación emitida y auditada. Cópiala ahora: no volverá a mostrarse. Envíala por un canal autorizado.");
      } else setNotice(`Decisión registrada. Recibo de auditoría: ${result.auditId.slice(0, 12)}…`);
    } catch (err) {
      setNotice(err instanceof Error ? `No se realizó el cambio: ${err.message}` : "No se realizó el cambio.");
    } finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.head}><div><span className={styles.kicker}><ShieldCheck size={16}/> REVISIÓN INSTITUCIONAL</span>
      <h1>Solicitudes de academias</h1>
      <p>Revisa la organización y registra decisiones auditables. Ninguna solicitud se convierte automáticamente en administrador.</p>
    </div><Link href="/learn">Volver a LUMA <ExternalLink size={16}/></Link></header>
    {!loading && !user && <section className={styles.panel} role="status">Accede con una cuenta autorizada de plataforma.</section>}
    {user && authorized === false && <section className={styles.panel} role="alert">No tienes autorización para revisar solicitudes institucionales o la función permanece deshabilitada.</section>}
    {user && authorized === null && <p role="status">Verificando autorización y consultando solicitudes…</p>}
    {authorized && <div className={styles.columns}>
      <section className={styles.panel} aria-label="Solicitudes recibidas">
        <div className={styles.sectionHead}><h2>Bandeja</h2><button className={styles.outline} type="button" onClick={() => {setRevision(v=>v+1);setOneTimeLink("");}}><RefreshCcw size={15}/> Actualizar</button></div>
        {rows.length===0 && <p>Actualmente no hay solicitudes.</p>}
        {rows.map(r=><button type="button" className={styles.item} aria-pressed={selected===r.applicationId} key={r.applicationId}
          onClick={()=>{setSelected(r.applicationId);setOneTimeLink("");setNotice("");setTenantId(r.tenantId||"");setProgramId(r.initialProgramId||"");}}>
          <strong>{r.organizationName}</strong><span>{r.countryCode} · {modality[r.deliveryMode]} · {r.learnerRange} participantes</span><small>{labels[r.status]} · {r.applicantEmail}</small></button>)}
        {cursor&&<button type="button" className={styles.outline} disabled={busy} onClick={()=>void more()}>Ver más solicitudes</button>}
      </section>
      <section className={styles.panel} aria-label="Revisar solicitud seleccionada">
        {!current?<div><h2>Selecciona una solicitud</h2><p>Comprueba los datos del solicitante antes de iniciar la revisión.</p></div>:<>
          <h2>{current.organizationName}</h2>
          <dl className={styles.data}>
            <div><dt>Solicitante</dt><dd>{current.applicantEmail}</dd></div>
            <div><dt>País</dt><dd>{current.countryCode}</dd></div>
            <div><dt>Enseñanza</dt><dd>{modality[current.deliveryMode]}</dd></div>
            <div><dt>Estado</dt><dd>{labels[current.status]}</dd></div>
            {current.firstReviewerUid&&<div><dt>Primera revisión</dt><dd>{current.firstReviewerUid.slice(0,8)}…</dd></div>}
          </dl>
          {current.status==="received"&&<>
            <label htmlFor="review-tenant">Identificador de academia propuesto</label>
            <input id="review-tenant" value={tenantId} onChange={e=>setTenantId(e.target.value)} placeholder="academia-guatemala"/>
            <label htmlFor="review-program">Identificador del primer programa</label>
            <input id="review-program" value={programId} onChange={e=>setProgramId(e.target.value)} placeholder="programa-inicial"/>
          </>}
          {current.status==="in_review"&&<p>Otra persona autorizada debe confirmar la revisión y emitir la invitación.
            {current.firstReviewerUid===user?.uid && " Como revisor inicial, no puedes emitirla tú mismo."}</p>}
          {current.status==="invitation_pending"&&<p>La invitación está pendiente. Puedes reemplazar el enlace anterior si se perdió o expiró.</p>}
          {current.status==="invitation_accepted"&&<p>El solicitante aceptó la invitación. Falta el aprovisionamiento explícito y auditado de su rol administrativo.</p>}
          {current.status==="activated"&&<><p>Cuenta autorizada. Continúa con el borrador institucional y la primera cohorte.</p>
            <button type="button" className={styles.outline} disabled={busy} onClick={()=>void bootstrap()}>
              Inicializar espacio institucional
            </button></>}
          <label htmlFor="review-reason">Justificación documentada</label>
          <textarea id="review-reason" value={reason} onChange={e=>setReason(e.target.value)} rows={3} maxLength={500}/>
          <div className={styles.actions}>
            {current.status==="received"&&<button type="button" disabled={busy||reason.length<20} onClick={()=>void decide("screen")}><Check size={16}/> Registrar primera revisión</button>}
            {current.status==="in_review"&&current.firstReviewerUid!==user?.uid&&<button type="button" disabled={busy||reason.length<20} onClick={()=>void decide("invite")}><Check size={16}/> Emitir invitación</button>}
            {current.status==="invitation_pending"&&<button type="button" disabled={busy||reason.length<20} onClick={()=>void decide("reissue")}>Reemitir enlace seguro</button>}
            {current.status==="invitation_pending"&&<button type="button" className={styles.outline} disabled={busy} onClick={()=>void decide("revoke_invitation")}>Revocar invitación</button>}
            {["received","in_review","invitation_pending","invitation_accepted"].includes(current.status)&&
              <button type="button" className={styles.danger} disabled={busy||reason.length<20} onClick={()=>void decide("reject")}><XCircle size={16}/> Rechazar solicitud</button>}
          </div>
          {oneTimeLink&&<div className={styles.secret} role="status"><strong>Enlace de un solo uso</strong><p>Solo el correo verificado asociado puede aceptarlo. Vence en 72 horas.</p><button className={styles.outline} type="button" onClick={()=>void navigator.clipboard.writeText(oneTimeLink)}><ClipboardCopy size={16}/> Copiar invitación</button></div>}
          {notice&&<p role="status">{notice}</p>}
        </>}
      </section>
    </div>}
  </main>;
}
