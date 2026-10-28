"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpenCheck, CheckCircle2 } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import type { AcademyApplicationRecord } from "@/lib/institutions/application";
import type { InstitutionDraft } from "@/lib/institutions/draft-store";
import type { ProgramOffering } from "@/lib/program-delivery";
import styles from "../solicitud/request.module.css";

type RequestState = "loading" | "blocked" | "ready" | "draft_missing" | "failed";
export default function FirstInstitutionCoursePage() {
  const { user, loading } = useLumaAuth();
  const [application, setApplication] = useState<AcademyApplicationRecord | null>(null);
  const [draft, setDraft] = useState<InstitutionDraft | null>(null);
  const [status, setStatus] = useState<RequestState>("loading");
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [cohortKey, setCohortKey] = useState("grupo-inicial");
  const [courseName, setCourseName] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"live" | "asynchronous" | "hybrid">("live");
  const [offering, setOffering] = useState<ProgramOffering | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (loading || !user) return;
    let valid = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/institutions/applications", {
          headers: { authorization: `Bearer ${token}` }, cache: "no-store",
        });
        if (!response.ok) throw Error("request_unavailable");
        const { application } = await response.json() as { application: AcademyApplicationRecord | null };
        if (!valid) return;
        setApplication(application);
        if (!application || application.status !== "activated" || !application.tenantId || !application.initialProgramId) {
          setStatus("blocked"); return;
        }
        const draftResponse = await fetch(`/api/platform/institutions/${encodeURIComponent(application.tenantId)}/draft`, {
          headers: { authorization: `Bearer ${token}` }, cache: "no-store",
        });
        if (!valid) return;
        if (draftResponse.status === 404 || draftResponse.status === 503) { setStatus("draft_missing"); return; }
        if (!draftResponse.ok) throw Error("draft_unavailable");
        const { draft } = await draftResponse.json() as { draft: InstitutionDraft };
        if (!valid) return;
        setDraft(draft);
        setName(draft.config.brand.displayName);
        setShortName(draft.config.brand.shortName);
        setCourseName(`${application.organizationName} · Curso inicial`);
        setStatus("ready");
      } catch { if (valid) setStatus("failed"); }
    })();
    return () => { valid = false; };
  }, [user, loading]);

  async function api<T>(path: string, body: object): Promise<T> {
    if (!user) throw Error("no_session");
    const response = await fetch(path, {
      method: "POST", cache: "no-store",
      headers: { authorization: `Bearer ${await user.getIdToken()}`,
        "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await response.json() as T & { error?: string };
    if (!response.ok) throw Error(json.error || "request_failed");
    return json;
  }

  async function saveBrand() {
    if (!draft || !application?.tenantId || !user || busy) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/platform/institutions/${application.tenantId}/draft`, {
        method: "PATCH", cache: "no-store",
        headers: { authorization: `Bearer ${await user.getIdToken()}`,
          "content-type": "application/json" },
        body: JSON.stringify({
          brand: { displayName: name, shortName, palette: draft.config.brand.palette },
          expectedVersion: draft.config.configVersion, requestId: crypto.randomUUID().replaceAll("-", ""),
          reasonCode: "brand-update",
        }),
      });
      if (!response.ok) throw Error("No se pudo actualizar el borrador institucional.");
      const updated = await fetch(`/api/platform/institutions/${application.tenantId}/draft`, {
        headers: { authorization: `Bearer ${await user.getIdToken()}` }, cache: "no-store",
      });
      if (updated.ok) setDraft((await updated.json() as { draft: InstitutionDraft }).draft);
      setNotice("Identidad visual del borrador actualizada y auditada.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "No pudimos guardar la identidad de la academia."); }
    finally { setBusy(false); }
  }

  async function createCourse() {
    if (!application?.tenantId || !application.initialProgramId || !draft || busy) return;
    setBusy(true); setNotice("");
    try {
      // Draft-only: a cohort is not the published teaching curriculum.
      const result = await api<{ offering: ProgramOffering }>("/api/programs/admin/offerings", {
        tenantId: application.tenantId, programId: application.initialProgramId,
        cohortKey, title: courseName, deliveryMode,
        timezone: application.timezone, status: "draft", coachIds: [],
      });
      setOffering(result.offering);
      setNotice("Primera cohorte guardada como borrador. Aún requiere lecciones, ejercicios y aprobación académica antes de publicarse.");
    } catch (e) { setNotice(e instanceof Error ? `No se guardó la cohorte: ${e.message}` : "Error al guardar el curso."); }
    finally { setBusy(false); }
  }
  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.brand} href="/academia/solicitud">LUMA <span>· Configuración</span></Link><Link href="/studio/programs">Gestión académica <ArrowRight size={16}/></Link></header>
    <div className={styles.layout}>
      <section className={styles.intro}>
        <span className={styles.eyebrow}><BookOpenCheck size={18}/> PRIMEROS PASOS</span>
        <h1>Prepara tu primera experiencia educativa.</h1>
        <p>Personaliza el nombre de tu academia y organiza tu primera cohorte. Las lecciones y evaluaciones necesitan revisión académica antes de publicarse para alumnos.</p>
        <div className={styles.process}>
          <p><CheckCircle2 size={18}/> Organización verificada y rol administrativo otorgado.</p>
          <p><BookOpenCheck size={18}/> Identidad institucional y cohorte en borrador.</p>
          <p>Publicación académica: pendiente de contenidos, rúbricas y evidencia de acceso.</p>
        </div>
      </section>
      <section className={styles.panel} aria-label="Preparar primera academia y curso">
        {loading || status === "loading" ? <p role="status">Verificando organización y permisos…</p> :
          !user ? <p>Inicia sesión con la cuenta administradora de la academia.</p> :
          status === "blocked" ? <div className={styles.message} role="alert"><h2>Tu academia aún no está activada.</h2><p>Primero debe completarse la revisión, aceptación de invitación y asignación auditada de tu rol.</p><Link href="/academia/solicitud">Consultar estado</Link></div> :
          status === "draft_missing" ? <div className={styles.message} role="status"><h2>Tu espacio está en preparación.</h2><p>El equipo de LUMA debe inicializar el borrador institucional antes de crear la primera cohorte.</p></div> :
          status === "failed" ? <div className={styles.message} role="alert"><h2>No se pudo verificar la configuración.</h2><p>Comprueba que tu sesión tiene el rol institucional actualizado.</p></div> :
          <div className={styles.form}>
            <h2>1. Identidad de tu academia</h2>
            <label htmlFor="first-brand">Nombre visible</label><input id="first-brand" value={name} maxLength={80} onChange={e=>setName(e.target.value)}/>
            <label htmlFor="first-short">Nombre corto</label><input id="first-short" value={shortName} maxLength={20} onChange={e=>setShortName(e.target.value)}/>
            <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void saveBrand()}>Guardar identidad institucional</button>
            <h2>2. Primera cohorte</h2>
            <label htmlFor="first-course-name">Nombre del curso</label><input id="first-course-name" value={courseName} maxLength={180} onChange={e=>setCourseName(e.target.value)}/>
            <label htmlFor="first-cohort-key">Nombre de la cohorte</label><input id="first-cohort-key" value={cohortKey} maxLength={120} onChange={e=>setCohortKey(e.target.value)}/>
            <label htmlFor="first-delivery">Modalidad</label>
            <select id="first-delivery" value={deliveryMode} onChange={e=>setDeliveryMode(e.target.value as typeof deliveryMode)}>
              <option value="live">Sesiones en vivo · high-ticket</option><option value="asynchronous">A tu ritmo · evergreen</option><option value="hybrid">Híbrido</option>
            </select>
            {offering&&<p role="status"><strong>Borrador guardado:</strong> {offering.title} ({offering.status}). Puedes continuar en Gestión académica.</p>}
            <button className={styles.primary} type="button" disabled={busy||!courseName.trim()||!cohortKey.trim()} onClick={()=>void createCourse()}>
              {busy ? "Guardando…" : "Guardar primer curso como borrador"} <ArrowRight size={16}/>
            </button>
            <small>Esto no publica contenido a estudiantes. Un curso solo estará listo para impartirse cuando sus módulos, evaluaciones y permisos superen el gate de publicación.</small>
            {notice&&<p role="status">{notice}</p>}
          </div>}
      </section>
    </div>
  </main>;
}
