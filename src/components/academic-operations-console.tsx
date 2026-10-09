"use client";

import { useEffect, useState } from "react";
import { BookOpenCheck, CalendarPlus, CheckCircle2, Users } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import { institutionalApi } from "@/lib/commerce/institutional-client";
import type {
  ProgramDeliveryMode, ProgramOffering, ProgramOfferingStatus, LiveProgramSession,
  RecordingPolicy,
} from "@/lib/program-delivery";
import styles from "./institutional-enrollment-console.module.css";

interface OfferingPage { offerings: ProgramOffering[]; nextCursor: string | null }
interface SessionPage { sessions: LiveProgramSession[]; nextCursor: string | null }
interface Claims {
  uid: string; tenants: string[]; allowed: boolean; superuser: boolean;
}

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const codes: Record<string, string> = {
    not_authorized: "Tu cuenta no tiene permisos para modificar esta organización.",
    invalid_program_offering: "Revisa los datos del programa, sus campos y la zona horaria.",
    invalid_program_session: "Revisa el horario, duración, enlace y proveedor de la sesión.",
    invalid_session_start: "La sesión debe comenzar en el futuro.",
    invalid_session_duration: "Las clases deben durar entre 10 y 720 minutos.",
    offering_not_schedulable: "Esta cohorte no puede recibir nuevas sesiones.",
  };
  return codes[message] || message || "No se pudo completar la operación.";
}

const initialOffering = {
  programId: "", cohortKey: "", title: "", timezone: "America/Guatemala",
  deliveryMode: "live" as ProgramDeliveryMode,
  coachIdsText: "", status: "draft" as ProgramOfferingStatus,
};
const initialSession = {
  title: "", startsAt: "", durationMinutes: 90,
  classroomProvider: "livekit" as "livekit" | "external",
  classroomCapacity: 120, joinUrl: "", recordingPolicy: "none" as RecordingPolicy,
};

export function AcademicOperationsConsole() {
  const { user, loading: authLoading } = useLumaAuth();
  const [permissions, setPermissions] = useState<Claims | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [offerings, setOfferings] = useState<ProgramOffering[]>([]);
  const [offeringCursor, setOfferingCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [offeringForm, setOfferingForm] = useState(initialOffering);
  const [sessionForm, setSessionForm] = useState(initialSession);
  const [sessions, setSessions] = useState<LiveProgramSession[]>([]);
  const [sessionCursor, setSessionCursor] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void user.getIdTokenResult().then(token => {
      if (cancelled) return;
      const c = token.claims;
      const superuser = c.superuser === true || c.role === "superuser";
      const tenants = [c.adminTenantIds, c.tenantIds, c.tenantId]
        .flatMap(value => typeof value === "string" ? [value] :
          Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
      const list = [...new Set(tenants)].sort();
      setPermissions({
        uid: user.uid, tenants: list, superuser,
        allowed: superuser || c.admin === true || c.role === "admin",
      });
      setTenantId(list[0] || "");
    }).catch(() => { if (!cancelled) setPermissions({
      uid: user.uid, tenants: [], superuser: false, allowed: false,
    }); });
    return () => { cancelled = true; };
  }, [user]);
  const currentPermissions = permissions?.uid === user?.uid ? permissions : null;

  useEffect(() => {
    if (!user || !tenantId || !currentPermissions?.allowed) return;
    let cancelled = false;
    void institutionalApi<OfferingPage>(
      "/api/programs/admin/offerings?tenantId=" + encodeURIComponent(tenantId),
    ).then(result => {
      if (cancelled) return;
      setOfferings(result.offerings);
      setOfferingCursor(result.nextCursor);
    }).catch(error => {
      if (!cancelled) setNotice(readableError(error));
    }).finally(() => { if (!cancelled) setLoadingData(false); });
    return () => { cancelled = true; };
  }, [tenantId, user, currentPermissions?.allowed, revision]);

  useEffect(() => {
    if (!selectedId || !user || !currentPermissions?.allowed) return;
    let cancelled = false;
    void institutionalApi<SessionPage>(
      "/api/programs/admin/offerings/" + encodeURIComponent(selectedId) + "/sessions?limit=50",
    ).then(result => {
      if (cancelled) return;
      setSessions(result.sessions);
      setSessionCursor(result.nextCursor);
    }).catch(error => { if (!cancelled) setNotice(readableError(error)); });
    return () => { cancelled = true; };
  }, [selectedId, revision, user, currentPermissions?.allowed]);

  const selected = offerings.find(item => item.offeringId === selectedId);
  const choose = (item: ProgramOffering) => {
    setSelectedId(item.offeringId);
    setOfferingForm({
      programId: item.programId, cohortKey: item.cohortKey, title: item.title,
      timezone: item.timezone, deliveryMode: item.deliveryMode,
      coachIdsText: item.coachIds.join(", "), status: item.status,
    });
    setSessions([]);
    setSessionCursor(null);
    setNotice("");
  };

  async function saveOffering(status: ProgramOfferingStatus) {
    setBusy(true); setNotice("");
    try {
      const payload = {
        tenantId, programId: offeringForm.programId.trim(),
        cohortKey: offeringForm.cohortKey.trim(), title: offeringForm.title.trim(),
        timezone: offeringForm.timezone.trim(), deliveryMode: offeringForm.deliveryMode,
        coachIds: offeringForm.coachIdsText.split(",").map(id => id.trim()).filter(Boolean),
        status,
      };
      const result = await institutionalApi<{ offering: ProgramOffering }>(
        "/api/programs/admin/offerings", { method: "POST", body: payload },
      );
      setSelectedId(result.offering.offeringId);
      setOfferingForm(current => ({ ...current, status }));
      setNotice(status === "active"
        ? "Cohorte activa. Ya puedes gestionar admisiones y sesiones."
        : "Cambios de la cohorte guardados.");
      setLoadingData(true);
      setRevision(n => n + 1);
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }

  async function saveSession() {
    if (!selected) return;
    setBusy(true); setNotice("");
    try {
      const startsAt = new Date(sessionForm.startsAt);
      if (Number.isNaN(startsAt.getTime())) throw new Error("invalid_session_start");
      await institutionalApi(
        "/api/programs/admin/offerings/" + encodeURIComponent(selected.offeringId) + "/sessions",
        { method: "POST", body: {
          title: sessionForm.title.trim(), startsAt: startsAt.toISOString(),
          durationMinutes: sessionForm.durationMinutes,
          classroomProvider: sessionForm.classroomProvider,
          ...(sessionForm.classroomProvider === "livekit"
            ? { classroomCapacity: sessionForm.classroomCapacity }
            : { joinUrl: sessionForm.joinUrl.trim() }),
          recordingPolicy: sessionForm.recordingPolicy,
        } },
      );
      setSessionForm(initialSession);
      setNotice("Sesión programada y vinculada a la cohorte.");
      setRevision(n => n + 1);
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }

  async function moreOfferings() {
    if (!offeringCursor) return;
    setBusy(true);
    try {
      const data = await institutionalApi<OfferingPage>(
        "/api/programs/admin/offerings?tenantId=" + encodeURIComponent(tenantId) +
        "&cursor=" + encodeURIComponent(offeringCursor),
      );
      setOfferings(old => [...old, ...data.offerings]);
      setOfferingCursor(data.nextCursor);
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }
  async function moreSessions() {
    if (!selected || !sessionCursor) return;
    setBusy(true);
    try {
      const page = await institutionalApi<SessionPage>(
        "/api/programs/admin/offerings/" + encodeURIComponent(selected.offeringId) +
        "/sessions?limit=50&cursor=" + encodeURIComponent(sessionCursor),
      );
      setSessions(old => [...old, ...page.sessions]);
      setSessionCursor(page.nextCursor);
    } catch (error) { setNotice(readableError(error)); }
    finally { setBusy(false); }
  }

  return <div className={styles.layout}>
    <section className={styles.hero}>
      <span className={styles.heroIcon}><BookOpenCheck size={28} /></span>
      <div><span className="eyebrow">GESTIÓN ACADÉMICA</span>
        <h2>De la planificación a una experiencia en vivo.</h2>
        <p>Organiza cohortes, asigna entrenadores, programa clases y activa el acceso de tus participantes sin salir de LUMA.</p>
      </div>
    </section>

    {!authLoading && !user && <section className={styles.panel} role="status">
      Inicia sesión con una cuenta administradora para gestionar programas.
    </section>}
    {user && currentPermissions?.allowed === false && <section className={styles.panel} role="alert">
      Esta cuenta no está habilitada para administrar programas.
    </section>}
    {user && currentPermissions?.allowed && <>
      <section className={styles.panel}>
        <label htmlFor="ops-tenant">Organización</label>
        {currentPermissions.superuser
          ? <input id="ops-tenant" value={tenantId} placeholder="Identificador de organización"
              onChange={event => {
                setTenantId(event.target.value); setSelectedId(""); setOfferings([]); setSessions([]); setLoadingData(true);
              }}/>
          : <select id="ops-tenant" value={tenantId} onChange={event => {
                setTenantId(event.target.value); setSelectedId(""); setOfferings([]); setSessions([]); setLoadingData(true);
              }}>
              <option value="">Selecciona la organización</option>
              {currentPermissions.tenants.map(tenant => <option key={tenant} value={tenant}>{tenant}</option>)}
            </select>}
        <p>El alcance de tu cuenta determina qué programas puedes consultar o modificar.</p>
      </section>
      {tenantId && <div className={styles.columns}>
        <section className={styles.panel}>
          <h3><Users size={20}/> Cohortes</h3>
          {loadingData ? <p>Consultando cohortes…</p> :
            <div className={styles.cards}>
              {offerings.length === 0 && <p>Todavía no existen programas para esta organización.</p>}
              {offerings.map(item => <button type="button" key={item.offeringId}
                className="button-secondary" disabled={busy} onClick={() => choose(item)}>
                {item.title} · {item.cohortKey} · {item.status}
              </button>)}
              {offeringCursor && <button className="button-secondary" type="button"
                disabled={busy} onClick={() => void moreOfferings()}>Ver más cohortes</button>}
            </div>}
          <button type="button" className="button-secondary" onClick={() => {
            setSelectedId(""); setSessions([]); setSessionCursor(null);
            setOfferingForm(initialOffering); setNotice("");
          }}>Crear otra cohorte</button>
          <h3><CalendarPlus size={19}/> {selected ? "Editar programa" : "Nuevo programa"}</h3>
          <label htmlFor="ops-program">ID de programa</label>
          <input id="ops-program" value={offeringForm.programId} disabled={Boolean(selected)}
            onChange={event => setOfferingForm(o => ({ ...o, programId: event.target.value }))}/>
          <label htmlFor="ops-cohort">Clave de cohorte</label>
          <input id="ops-cohort" value={offeringForm.cohortKey} disabled={Boolean(selected)}
            onChange={event => setOfferingForm(o => ({ ...o, cohortKey: event.target.value }))}/>
          <label htmlFor="ops-title">Nombre del programa</label>
          <input id="ops-title" value={offeringForm.title}
            onChange={event => setOfferingForm(o => ({ ...o, title: event.target.value }))}/>
          <label htmlFor="ops-mode">Modalidad</label>
          <select id="ops-mode" value={offeringForm.deliveryMode}
            onChange={event => setOfferingForm(o => ({ ...o, deliveryMode: event.target.value as ProgramDeliveryMode }))}>
            <option value="live">En vivo</option><option value="hybrid">Híbrido</option>
            <option value="asynchronous">Asincrónico</option>
          </select>
          <label htmlFor="ops-timezone">Zona horaria IANA</label>
          <input id="ops-timezone" value={offeringForm.timezone}
            onChange={event => setOfferingForm(o => ({ ...o, timezone: event.target.value }))}/>
          <label htmlFor="ops-coaches">UID de entrenadores asignados (separados por coma)</label>
          <textarea id="ops-coaches" rows={2} value={offeringForm.coachIdsText}
            onChange={event => setOfferingForm(o => ({ ...o, coachIdsText: event.target.value }))}/>
          <label htmlFor="ops-status">Estado</label>
          <select id="ops-status" value={offeringForm.status}
            onChange={event => setOfferingForm(o => ({ ...o, status: event.target.value as ProgramOfferingStatus }))}>
            <option value="draft">Borrador</option><option value="active">Activo</option>
            <option value="completed">Finalizado</option><option value="archived">Archivado</option>
          </select>
          <button type="button" className="button-primary" disabled={busy ||
            !offeringForm.title.trim() || !offeringForm.programId.trim() || !offeringForm.cohortKey.trim()}
            onClick={() => void saveOffering(offeringForm.status)}>
            <CheckCircle2 size={17}/> Guardar cohorte
          </button>
        </section>

        <section className={styles.panel}>
          <h3><CalendarPlus size={20}/> Clases de la cohorte</h3>
          {!selected ? <p>Selecciona una cohorte para planificar las sesiones.</p> : <>
            <p><strong>{selected.title}</strong> · {selected.cohortKey}</p>
            {selected.deliveryMode === "asynchronous" ?
              <p>Esta modalidad no requiere sesiones en vivo.</p> : <>
                <label htmlFor="ops-session-title">Título de la sesión</label>
                <input id="ops-session-title" value={sessionForm.title}
                  onChange={event => setSessionForm(o => ({ ...o, title: event.target.value }))}/>
                <label htmlFor="ops-start">Fecha y hora local del dispositivo</label>
                <input id="ops-start" type="datetime-local" value={sessionForm.startsAt}
                  onChange={event => setSessionForm(o => ({ ...o, startsAt: event.target.value }))}/>
                <p>Introduce la hora de tu dispositivo; LUMA guarda UTC y muestra las sesiones en la zona de la cohorte ({selected.timezone}).</p>
                <label htmlFor="ops-duration">Duración (minutos)</label>
                <input id="ops-duration" type="number" min={10} max={720} step={5}
                  value={sessionForm.durationMinutes}
                  onChange={event => setSessionForm(o => ({ ...o, durationMinutes: Number(event.target.value) }))}/>
                <label htmlFor="ops-provider">Aula virtual</label>
                <select id="ops-provider" value={sessionForm.classroomProvider}
                  onChange={event => setSessionForm(o => ({ ...o, classroomProvider: event.target.value as "livekit" | "external" }))}>
                  <option value="livekit">Integrada en LUMA (LiveKit)</option>
                  <option value="external">Enlace externo</option>
                </select>
                {sessionForm.classroomProvider === "livekit" ?
                  <>
                    <label htmlFor="ops-capacity">Capacidad de sala</label>
                    <input id="ops-capacity" type="number" min={2} max={1000}
                      value={sessionForm.classroomCapacity}
                      onChange={event => setSessionForm(o => ({ ...o, classroomCapacity: Number(event.target.value) }))}/>
                  </>
                  : <>
                    <label htmlFor="ops-join">Enlace seguro HTTPS</label>
                    <input id="ops-join" type="url" placeholder="https://..."
                      value={sessionForm.joinUrl}
                      onChange={event => setSessionForm(o => ({ ...o, joinUrl: event.target.value }))}/>
                  </>}
                <label htmlFor="ops-recording">Política de grabación</label>
                <select id="ops-recording" value={sessionForm.recordingPolicy}
                  onChange={event => setSessionForm(o => ({ ...o, recordingPolicy: event.target.value as RecordingPolicy }))}>
                  <option value="none">Sin grabación</option>
                  <option value="optional">Opcional según consentimiento</option>
                  <option value="available_after_session">Disponible después</option>
                </select>
                <button type="button" className="button-primary" disabled={busy ||
                  selected.status === "archived" || selected.status === "completed" ||
                  !sessionForm.title.trim() || !sessionForm.startsAt ||
                  (sessionForm.classroomProvider === "external" && !sessionForm.joinUrl.trim())}
                  onClick={() => void saveSession()}>
                  <CalendarPlus size={17}/> Programar sesión
                </button>
              </>}
            <h3>Calendario registrado</h3>
            <div className={styles.cards}>
              {sessions.length === 0 && <p>Sin sesiones registradas.</p>}
              {sessions.map(session => <article className={styles.record} key={session.sessionId}>
                <div className={styles.recordTop}><strong>{session.title}</strong>
                  <span>{session.status}</span></div>
                <p>{new Date(session.startsAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short", timeZone: selected.timezone })} · {session.durationMinutes} min</p>
                <p>{session.classroomProvider === "livekit" ? "Aula LUMA" : "Enlace externo"} ·
                  Grabación: {session.recordingPolicy === "none" ? "no" : "según política"}</p>
              </article>)}
              {sessionCursor && <button type="button" className="button-secondary" disabled={busy}
                onClick={() => void moreSessions()}>Ver más sesiones</button>}
            </div>
          </>}
        </section>
      </div>}
    </>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
  </div>;
}
