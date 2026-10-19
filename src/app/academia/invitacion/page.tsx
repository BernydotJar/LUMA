"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import styles from "../solicitud/request.module.css";

type Proof = { applicationId: string; token: string; collectedAt: number };
const SESSION_KEY = "luma-pending-academy-invitation";
const LIFE = 15 * 60_000;
function readProof(): Proof | null {
  let result: Proof | null = null;
  try {
    const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    if (raw) {
      const params = new URLSearchParams(raw);
      const applicationId = params.get("app") ?? "";
      const token = params.get("token") ?? "";
      if (/^[a-f0-9]{64}$/.test(applicationId) && /^[A-Za-z0-9_-]{43}$/.test(token)) {
        result = { applicationId, token, collectedAt: Date.now() };
      }
      // Fragment is not sent in HTTP; remove before any outbound requests.
      window.history.replaceState(null, "", window.location.pathname);
    } else {
      const stored = window.sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Proof;
        if (/^[a-f0-9]{64}$/.test(parsed.applicationId) &&
            /^[A-Za-z0-9_-]{43}$/.test(parsed.token) &&
            Number.isFinite(parsed.collectedAt) && Date.now() - parsed.collectedAt < LIFE) result = parsed;
      }
    }
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch { /* Blocked browser storage cannot cause privilege escalation. */ }
  return result;
}
export default function AcademyInvitationPage() {
  const { user, loading } = useLumaAuth();
  const [proof, setProof] = useState<Proof | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    // Browser fragment and session storage are read after hydration, not during SSR.
    void Promise.resolve().then(() => {
      if (!live) return;
      setProof(readProof()); setReady(true);
    });
    return () => { live = false; };
  }, []);

  async function submit() {
    if (!user || !proof || submitting) return;
    setSubmitting(true); setNotice("");
    const current = proof;
    setProof(null); // The bearer secret is discarded before the network request.
    try {
      const response = await fetch("/api/institutions/invitations/accept", {
        method: "POST", cache: "no-store",
        headers: { authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json" },
        body: JSON.stringify({ applicationId: current.applicationId, token: current.token }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setNotice(data.error === "invitation_expired" ? "Esta invitación venció. Solicita una nueva invitación a la academia." :
          data.error === "not_authorized" || data.error === "invalid_invitation" ?
            "El enlace solo puede aceptarlo la cuenta de correo verificada invitada. Si cambiaste de cuenta, vuelve a abrir el enlace original." :
            "No pudimos verificar la invitación. Solicita a la academia que te envíe un enlace nuevo.");
        return;
      }
      setAccepted(true);
    } catch { setNotice("No pudimos conectar con el servicio. Solicita un enlace nuevo si el problema continúa."); }
    finally { setSubmitting(false); }
  }
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/academia/solicitud" className={styles.brand}>LUMA <span>· Invitación</span></Link><Link href="/learn">Explorar LUMA</Link></header>
    <div className={styles.layout}>
      <section className={styles.intro}><span className={styles.eyebrow}><ShieldCheck size={18}/> IDENTIDAD VERIFICADA</span>
        <h1>Tu academia empieza con una invitación segura.</h1>
        <p>La solicitud fue revisada antes de invitarte. Confirma tu identidad con la misma cuenta con la que solicitaste el espacio institucional.</p>
        <div className={styles.process}><p>Esta confirmación no modifica automáticamente tus permisos. La activación institucional requiere una decisión operativa independiente.</p></div>
      </section>
      <section className={styles.panel} aria-label="Aceptar invitación">
        {!ready || loading ? <p role="status">Comprobando invitación y sesión…</p> : accepted ? <div className={styles.message} role="status">
          <h2>Invitación aceptada</h2>
          <p>Tu aceptación fue registrada. El equipo de LUMA completará la autorización del primer administrador mediante un procedimiento auditado. Podrás consultar su estado en tu solicitud.</p>
          <Link className={styles.primary} href="/academia/solicitud">Ver estado <ArrowRight size={17}/></Link>
        </div> : !proof ? <div className={styles.message} role="alert">
          <h2>Abre un enlace válido de invitación</h2>
          <p>El enlace es privado, de un solo uso y puede haber expirado. Pide al equipo institucional uno nuevo si no lo tienes.</p>
          <Link href="/academia/solicitud">Ver mi solicitud</Link>
        </div> : !user ? <div className={styles.message}>
          <h2>Accede con tu cuenta verificada</h2>
          <p>Conservaremos esta invitación solo durante el siguiente inicio de sesión en este navegador.</p>
          <Link className={styles.primary} href="/login?next=%2Facademia%2Finvitacion" onClick={() => {
            try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(proof)); }
            catch { /* User can reopen the link after login. */ }
          }}>Iniciar sesión <ArrowRight size={17}/></Link>
        </div> : <div className={styles.message}>
          <h2>Confirmar invitación</h2>
          <p>Se registrará la aceptación para esta cuenta. Solo puede usarse una vez; el enlace dejará de ser válido después.</p>
          <button className={styles.primary} type="button" onClick={() => void submit()} disabled={submitting}>
            {submitting ? "Validando…" : "Aceptar invitación"} <ArrowRight size={17}/>
          </button>
        </div>}
        {notice && <p role="alert" className={styles.notice}>{notice}</p>}
      </section>
    </div>
  </main>;
}
