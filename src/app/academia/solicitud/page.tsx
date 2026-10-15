"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Building2, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import type {
  AcademyApplicationInput, AcademyApplicationRecord,
} from "@/lib/institutions/application";
import styles from "./request.module.css";

const empty: AcademyApplicationInput = {
  organizationName: "", countryCode: "GT", timezone: "America/Guatemala",
  deliveryMode: "live", learnerRange: "1-50", contactRole: "owner",
};

type RequestState = "loading" | "available" | "submitted" | "disabled" | "denied" | "error";
const loginHref = "/login?next=%2Facademia%2Fsolicitud";

export default function AcademyApplicationPage() {
  const { user, loading } = useLumaAuth();
  const [form, setForm] = useState<AcademyApplicationInput>(empty);
  const [record, setRecord] = useState<AcademyApplicationRecord | null>(null);
  const [status, setStatus] = useState<RequestState>("loading");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [requestCount, setRequestCount] = useState(0);

  // Resolve disabled onboarding BEFORE asking an unauthenticated visitor to
  // sign in. API feature state is public but never reveals private applications.
  useEffect(() => {
    if (loading || user) return;
    let active = true;
    void fetch("/api/institutions/applications", { cache: "no-store" })
      .then((response) => {
        if (!active) return;
        setStatus(response.status === 503 ? "disabled" : "available");
      })
      .catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [loading, user, requestCount]);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/institutions/applications", {
          headers: { authorization: `Bearer ${token}` }, cache: "no-store",
        });
        if (!active) return;
        if (response.status === 503) { setStatus("disabled"); return; }
        if (response.status === 401 || response.status === 403) { setStatus("denied"); return; }
        if (!response.ok) throw new Error("status_failed");
        const data = await response.json() as { application: AcademyApplicationRecord | null };
        if (!active) return;
        setRecord(data.application);
        setStatus(data.application ? "submitted" : "available");
      } catch {
        if (active) setStatus("error");
      }
    })();
    return () => { active = false; };
  }, [loading, user, requestCount]);

  const refresh = useCallback(() => {
    setStatus("loading"); setNotice(""); setRequestCount((n) => n + 1);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || sending) return;
    setSending(true); setNotice("");
    try {
      const response = await fetch("/api/institutions/applications", {
        method: "POST", cache: "no-store",
        headers: {
          authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (response.status === 409) {
        setNotice("Ya existe una solicitud con otros datos. Consulta con nuestro equipo antes de enviarla de nuevo.");
        return;
      }
      if (response.status === 503) { setStatus("disabled"); return; }
      if (response.status === 401 || response.status === 403) {
        setStatus("denied"); return;
      }
      if (!response.ok) throw new Error("submit_failed");
      const data = await response.json() as { application: AcademyApplicationRecord };
      setRecord(data.application); setStatus("submitted");
    } catch {
      setNotice("No pudimos confirmar tu solicitud. Puedes reintentar sin crear una segunda solicitud.");
    } finally { setSending(false); }
  }

  const patch = <K extends keyof AcademyApplicationInput>(key: K, value: AcademyApplicationInput[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/learn" className={styles.brand}>LUMA <span>· Academias</span></Link>
        <Link href="/learn">Explorar LUMA <ArrowRight size={16} aria-hidden="true" /></Link>
      </header>
      <div className={styles.layout}>
        <section className={styles.intro} aria-labelledby="academy-title">
          <span className={styles.eyebrow}><Building2 size={17} aria-hidden="true" /> Tu organización en LUMA</span>
          <h1 id="academy-title">Tu academia, preparada para enseñar y acompañar.</h1>
          <p>Cuéntanos sobre tu institución. Revisaremos tu solicitud antes de habilitar tu espacio y sus permisos. No necesitas conocer los detalles técnicos de la plataforma.</p>
          <div className={styles.process} aria-label="Cómo comienza tu academia">
            <p><CheckCircle2 size={18} aria-hidden="true" /> Envías la información básica de tu academia.</p>
            <p><ShieldCheck size={18} aria-hidden="true" /> Nuestro equipo valida la identidad y la autorización institucional.</p>
            <p><Clock3 size={18} aria-hidden="true" /> Después de la aprobación recibirás instrucciones para configurar tus cursos.</p>
          </div>
        </section>
        <section className={styles.panel} aria-label="Solicitud de una academia">
          {loading || status === "loading" ? (
            <p role="status">Comprobando tu sesión y el estado de tu solicitud…</p>
          ) : status === "disabled" ? (
            <div className={styles.message} role="status"><h2>Estamos preparando nuevas solicitudes.</h2><p>El alta institucional todavía no está habilitada en este entorno. Esto no afecta tu acceso como participante.</p><Link href="/learn">Volver a LUMA</Link></div>
          ) : status === "error" ? (
            <div className={styles.message} role="alert"><h2>No pudimos consultar el servicio.</h2><p>Tu solicitud no se modificó. Comprueba tu conexión e inténtalo de nuevo.</p><button type="button" className={styles.secondary} onClick={refresh}>Reintentar</button></div>
          ) : !user ? (
            <div className={styles.message}>
              <h2>Primero, confirma quién eres.</h2>
              <p>Accede con tu cuenta para asociar la solicitud con una identidad verificada.</p>
              <Link className={styles.primary} href={loginHref}>Continuar con Google <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          ) : status === "submitted" && record ? (
            <div className={styles.message} role="status">
              <span className={styles.confirmed}><CheckCircle2 size={20} aria-hidden="true" /> Solicitud registrada</span>
              <h2>{record.organizationName}</h2>
              <p>La solicitud está guardada en LUMA. La academia todavía no está activada y esta cuenta no ha recibido privilegios institucionales.</p>
              <dl className={styles.summary}>
                <div><dt>Estado</dt><dd>{record.status === "received" ? "Pendiente de revisión" : record.status === "in_review" ? "En revisión" : record.status === "invitation_pending" ? "Invitación pendiente" : record.status === "activated" ? "Activación confirmada" : "No aprobada"}</dd></div>
                <div><dt>Correo verificado</dt><dd>{record.applicantEmail}</dd></div>
                <div><dt>Fecha de recepción</dt><dd>{new Date(record.createdAt).toLocaleDateString("es-GT")}</dd></div>
              </dl>
              <button type="button" className={styles.secondary} onClick={refresh}>Consultar estado</button>
            </div>
          ) : status === "denied" ? (
            <div className={styles.message} role="alert"><h2>Necesitamos confirmar tu identidad.</h2><p>Para solicitar una academia se requiere una cuenta con correo verificado.</p><Link href={loginHref}>Volver a acceder</Link></div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className={styles.form}>
              <h2>Cuéntanos sobre tu academia</h2>
              <p>Estos datos sirven para revisar tu solicitud, no para activar permisos automáticamente.</p>
              <label htmlFor="academy-name">Nombre de tu academia</label>
              <input id="academy-name" value={form.organizationName} required minLength={2} maxLength={100} autoComplete="organization" placeholder="Ej. Academia de Excelencia" onChange={(e) => patch("organizationName", e.target.value)} />
              <label htmlFor="academy-role">Tu relación con la academia</label>
              <select id="academy-role" value={form.contactRole} onChange={(e) => patch("contactRole", e.target.value as AcademyApplicationInput["contactRole"])}>
                <option value="owner">Propietario/a</option><option value="director">Dirección</option><option value="academic">Coordinación académica</option>
              </select>
              <label htmlFor="academy-country">País</label>
              <select id="academy-country" value={form.countryCode} onChange={(e) => {
                const country = e.target.value;
                setForm((previous) => ({ ...previous, countryCode: country,
                  timezone: country === "GT" ? "America/Guatemala" : country === "CO" ? "America/Bogota" : country === "MX" ? "America/Mexico_City" : "America/New_York" }));
              }}><option value="GT">Guatemala</option><option value="CO">Colombia</option><option value="MX">México</option><option value="US">Estados Unidos</option></select>
              <label htmlFor="academy-delivery">¿Cómo impartes tus cursos?</label>
              <select id="academy-delivery" value={form.deliveryMode} onChange={(e) => patch("deliveryMode", e.target.value as AcademyApplicationInput["deliveryMode"])}><option value="live">Clases en vivo / programas premium</option><option value="evergreen">Cursos grabados / evergreen</option><option value="hybrid">Ambas modalidades</option></select>
              <label htmlFor="academy-learners">¿Cuántos participantes estimas atender?</label>
              <select id="academy-learners" value={form.learnerRange} onChange={(e) => patch("learnerRange", e.target.value as AcademyApplicationInput["learnerRange"])}><option value="1-50">1 a 50</option><option value="51-200">51 a 200</option><option value="201-1000">201 a 1,000</option><option value="1000+">Más de 1,000</option></select>
              {notice && <p role="alert" className={styles.notice}>{notice}</p>}
              <button type="submit" className={styles.primary} disabled={sending}>{sending ? "Confirmando…" : "Enviar solicitud"} <ArrowRight size={17} aria-hidden="true" /></button>
              <small>Enviar una solicitud no crea una cuenta administradora ni contrata un servicio. La activación requiere revisión y aprobación.</small>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
