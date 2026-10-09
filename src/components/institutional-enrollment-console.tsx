"use client";

import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, BookUser, ShieldCheck, UserMinus, UserPlus } from "lucide-react";
import { useLumaAuth } from "@/components/auth-provider";
import { institutionalApi } from "@/lib/commerce/institutional-client";
import { InstitutionalBulkImport } from "@/components/institutional-bulk-import";
import styles from "./institutional-enrollment-console.module.css";

type Offering = { offeringId: string; programId: string; title: string; cohortKey: string };
type Enrollment = {
  enrollmentId: string; email: string; programId: string;
  offeringId: string; status: "active" | "revoked";
  accessEndsAt: string; learnerLinked: boolean;
  institutionalRevision: number; updatedAt: string;
};
type PagedOfferings = { offerings: Offering[]; nextCursor: string | null };
type PagedGrants = { records: Enrollment[]; nextCursor: string | null };

const errors: Record<string, string> = {
  institutional_tenant_forbidden: "Tu cuenta no está autorizada para administrar esta organización.",
  institutional_admin_required: "Se requiere el rol de administrador institucional.",
  institutional_offering_not_active: "La cohorte debe existir y encontrarse activa.",
  institutional_active_conflict: "La matrícula ya existe con una vigencia igual o superior.",
  institutional_reactivation_confirmation_required:
    "La matrícula fue revocada. Confirma expresamente que deseas reactivarla.",
  institutional_expiry_invalid: "La fecha de caducidad debe estar en el futuro y dentro de los próximos dos años.",
  institutional_email_invalid: "Revisa el correo electrónico del participante.",
  institutional_reason_invalid: "Registra una justificación de al menos 20 caracteres.",
};

function messageFor(error: unknown) {
  const text = error instanceof Error ? error.message : "";
  return errors[text] || text || "No se pudo completar la solicitud.";
}

export function InstitutionalEnrollmentConsole() {
  const { user, loading: authLoading } = useLumaAuth();
  const [privileges, setPrivileges] = useState<{ uid: string; allowed: boolean; superuser: boolean; tenants: string[] } | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringCursor, setOfferingCursor] = useState<string | null>(null);
  const [selectedOfferingId, setSelectedOfferingId] = useState("");
  const [records, setRecords] = useState<Enrollment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [allowReactivation, setAllowReactivation] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid;
    if (!user) return;
    void user.getIdTokenResult().then(token => {
      if (cancelled || uid !== user.uid) return;
      const claims = token.claims;
      const isSuperuser = claims.superuser === true || claims.role === "superuser";
      const isAdmin = isSuperuser || claims.admin === true || claims.role === "admin";
      const tenants = [claims.tenantId, claims.tenantIds, claims.adminTenantIds]
        .flatMap(value => typeof value === "string" ? [value] :
          Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
      const unique = [...new Set(tenants)].sort();
      setPrivileges({ uid: user.uid, allowed: isAdmin, superuser: isSuperuser, tenants: unique });
      setTenantId(unique.length ? unique[0] : "");
    }).catch(() => { if (!cancelled) setPrivileges({ uid: user.uid, allowed: false, superuser: false, tenants: [] }); });
    return () => { cancelled = true; };
  }, [user]);

  const currentPrivileges = privileges?.uid === user?.uid ? privileges : null;

  useEffect(() => {
    if (!user || !tenantId || !currentPrivileges?.allowed) return;
    let cancelled = false;
    void Promise.all([
      institutionalApi<PagedOfferings>("/api/enrollments/institutional/offerings?tenantId=" + encodeURIComponent(tenantId)),
      institutionalApi<PagedGrants>("/api/enrollments/institutional?tenantId=" + encodeURIComponent(tenantId)),
    ]).then(([programData, enrollmentData]) => {
      if (cancelled) return;
      setOfferings(programData.offerings);
      setOfferingCursor(programData.nextCursor);
      setRecords(enrollmentData.records);
      setNextCursor(enrollmentData.nextCursor);
    }).catch(error => { if (!cancelled) setNotice(messageFor(error)); })
      .finally(() => { if (!cancelled) setDataLoading(false); });
    return () => { cancelled = true; };
  }, [user, currentPrivileges?.allowed, tenantId, revision]);

  const selectedOffering = offerings.find(item => item.offeringId === selectedOfferingId);
  async function grant() {
    if (!selectedOffering || !tenantId) return;
    setBusy(true); setNotice("");
    try {
      const result = await institutionalApi<{ action: string; duplicate: boolean }>(
        "/api/enrollments/institutional", {
          method: "POST",
          body: {
            tenantId, programId: selectedOffering.programId,
            offeringId: selectedOffering.offeringId, email: email.trim(),
            reason, expiresAt: new Date(expiryDate + "T23:59:59Z").toISOString(),
            allowReactivation,
          },
        },
      );
      setNotice(result.duplicate
        ? "La matrícula ya estaba activa con la misma vigencia. No se generó un segundo registro."
        : result.action === "extended" ? "Vigencia extendida y registrada en la auditoría."
          : result.action === "reactivated" ? "Matrícula reactivada con autorización registrada."
            : "Matrícula institucional creada. El participante podrá reclamarla al verificar su correo.");
      setEmail(""); setReason(""); setAllowReactivation(false);
      setDataLoading(true);
      setRevision(n => n + 1);
    } catch (error) { setNotice(messageFor(error)); }
    finally { setBusy(false); }
  }

  async function revoke() {
    if (!revokeId || revokeReason.trim().length < 20) return;
    setBusy(true); setNotice("");
    try {
      await institutionalApi("/api/enrollments/institutional/" + encodeURIComponent(revokeId), {
        method: "POST", body: { tenantId, reason: revokeReason.trim() },
      });
      setRevokeId(null); setRevokeReason("");
      setNotice("Acceso institucional revocado. La decisión quedó registrada en la auditoría.");
      setRevision(n => n + 1);
    } catch (error) { setNotice(messageFor(error)); }
    finally { setBusy(false); }
  }

  async function loadMoreOfferings() {
    if (!offeringCursor || !tenantId) return;
    setBusy(true);
    try {
      const page = await institutionalApi<PagedOfferings>(
        "/api/enrollments/institutional/offerings?tenantId=" + encodeURIComponent(tenantId) +
        "&cursor=" + encodeURIComponent(offeringCursor),
      );
      setOfferings(current => [...current, ...page.offerings]);
      setOfferingCursor(page.nextCursor);
    } catch (error) { setNotice(messageFor(error)); }
    finally { setBusy(false); }
  }

  async function loadMore() {
    if (!nextCursor || !tenantId) return;
    setBusy(true);
    try {
      const page = await institutionalApi<PagedGrants>(
        "/api/enrollments/institutional?tenantId=" + encodeURIComponent(tenantId) +
        "&cursor=" + encodeURIComponent(nextCursor),
      );
      setRecords(current => [...current, ...page.records]);
      setNextCursor(page.nextCursor);
    } catch (error) { setNotice(messageFor(error)); }
    finally { setBusy(false); }
  }

  return <div className={styles.layout}>
    <section className={styles.hero}>
      <span className={styles.heroIcon}><BookUser size={27} /></span>
      <div><span className="eyebrow">OPERACIÓN INSTITUCIONAL</span>
        <h2>Gestiona la admisión con identidad, vigencia y evidencia.</h2>
        <p>Para invitaciones, becas o acuerdos externos. Las compras por Hotmart y Stripe conservan su flujo independiente; aquí no se crea una venta ficticia.</p>
      </div>
    </section>

    {!authLoading && !user && <section className={styles.panel} role="status">
      Inicia sesión como administrador autorizado para inscribir participantes.
    </section>}
    {user && currentPrivileges?.allowed === false && <section className={styles.panel} role="alert">
      Tu cuenta no tiene permisos administrativos para gestionar matrículas institucionales.
    </section>}
    {user && currentPrivileges?.allowed && <>
      <section className={styles.panel}>
        <label htmlFor="institutional-tenant">Organización autorizada</label>
        {currentPrivileges.superuser ? <input id="institutional-tenant" value={tenantId}
            placeholder="Identificador del tenant" onChange={event => {
              setTenantId(event.target.value); setSelectedOfferingId(""); setRecords([]); setOfferings([]); setDataLoading(true);
            }} />
          : <select id="institutional-tenant" value={tenantId} onChange={event => {
              setTenantId(event.target.value); setSelectedOfferingId(""); setRecords([]); setOfferings([]);
            }}>
              <option value="">Selecciona una organización</option>
              {currentPrivileges.tenants.map(tenant => <option key={tenant} value={tenant}>{tenant}</option>)}
            </select>}
        <p>Solo se permiten acciones sobre organizaciones incluidas en el alcance administrativo de tu cuenta.</p>
      </section>

      {tenantId && <div className={styles.columns}>
        <section className={styles.panel}>
          <h3><UserPlus size={20}/> Nueva matrícula o ampliación</h3>
          <label htmlFor="institutional-offering">Programa / cohorte activa</label>
          <select id="institutional-offering" value={selectedOfferingId}
            onChange={event => setSelectedOfferingId(event.target.value)}>
            <option value="">Selecciona una cohorte</option>
            {offerings.map(item => <option value={item.offeringId} key={item.offeringId}>
              {item.title} · {item.cohortKey}
            </option>)}
          </select>
          {offeringCursor && <button type="button" className="button-secondary"
            disabled={busy} onClick={() => void loadMoreOfferings()}>Ver más cohortes</button>}
          <label htmlFor="institutional-email">Correo del participante</label>
          <input id="institutional-email" type="email" autoComplete="email" maxLength={254}
            value={email} onChange={event => setEmail(event.target.value)}
            placeholder="participante@empresa.com"/>
          <label htmlFor="institutional-expiry">Acceso válido hasta</label>
          <input id="institutional-expiry" type="date" value={expiryDate}
            onChange={event => setExpiryDate(event.target.value)} />
          <label htmlFor="institutional-reason">Justificación institucional</label>
          <textarea id="institutional-reason" rows={4} maxLength={500}
            placeholder="Motivo, autorización o acuerdo que respalda el acceso (mínimo 20 caracteres)."
            value={reason} onChange={event => setReason(event.target.value)} />
          <label className={styles.checkbox}>
            <input type="checkbox" checked={allowReactivation}
              onChange={event => setAllowReactivation(event.target.checked)} />
            <span>Autorizar expresamente la reactivación si este acceso fue revocado antes.</span>
          </label>
          <button type="button" className="button-primary" disabled={busy || dataLoading ||
            !selectedOffering || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            !expiryDate || reason.trim().length < 20}
            onClick={() => void grant()}><ShieldCheck size={17}/> Registrar matrícula</button>
          <p>La vigencia comienza al registrar la decisión. El participante activa su acceso cuando ingresa con el mismo correo verificado.</p>
        </section>
        <section className={styles.panel}>
          <h3><BadgeCheck size={20}/> Matrículas registradas</h3>
          {dataLoading ? <p role="status">Consultando accesos autorizados…</p> :
            records.length === 0 ? <p>No existen matrículas institucionales en la página consultada.</p> :
            <div className={styles.cards}>{records.map(item => (
              <article className={styles.record} key={item.enrollmentId}>
                <div className={styles.recordTop}>
                  <strong>{item.email}</strong>
                  <span data-status={item.status}>
                    {item.status === "active" ? "Activa" : "Revocada"}
                  </span>
                </div>
                <p>Programa: {item.programId} · Cohorte: {item.offeringId}</p>
                <p>Vence: {item.accessEndsAt?.slice(0,10) ?? "Sin fecha" } ·
                  {item.learnerLinked ? " Vinculada a identidad" : " Pendiente de ingreso"}</p>
                {item.status === "active" && <button type="button" className="button-secondary"
                  disabled={busy} onClick={() => {
                    setRevokeId(item.enrollmentId); setRevokeReason("");
                  }}><UserMinus size={15}/> Revocar acceso</button>}
                {revokeId === item.enrollmentId && <div className={styles.revoke}>
                  <label htmlFor="institutional-revoke-reason">Motivo de revocación inmediata</label>
                  <textarea id="institutional-revoke-reason" maxLength={500}
                    value={revokeReason} onChange={event => setRevokeReason(event.target.value)}
                    placeholder="Explica la decisión (mínimo 20 caracteres)." rows={3}/>
                  <button type="button" className="button-primary" disabled={busy || revokeReason.trim().length < 20}
                    onClick={() => void revoke()}>Confirmar revocación</button>
                  <button type="button" className="button-secondary"
                    disabled={busy} onClick={() => { setRevokeId(null); setRevokeReason(""); }}>Cancelar</button>
                </div>}
              </article>
            ))}</div>}
          {nextCursor && <button type="button" className="button-secondary"
            disabled={busy} onClick={() => void loadMore()}>
            Ver más matrículas <ArrowRight size={14}/>
          </button>}
        </section>
      </div>}
      {tenantId && <InstitutionalBulkImport key={tenantId} tenantId={tenantId}
        offerings={offerings} onCompleted={() => {
          setDataLoading(true);
          setRevision(current => current + 1);
        }}/>}
    </>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </div>;
}
