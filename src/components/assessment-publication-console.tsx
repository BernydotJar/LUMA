"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CheckCheck, CircleAlert, FileCheck2, RotateCcw, ShieldCheck, ShieldX } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase-client";
import { useLumaAuth } from "@/components/auth-provider";
import { classContracts } from "@/lib/class-contract";
import styles from "./assessment-publication-console.module.css";

type PublicationStatus = "prepared" | "reviewed" | "published" | "withdrawn";
type Plan = {
  planRevision: number;
  status: PublicationStatus;
  version: string;
  offeringId: string;
  curriculumRevision: string;
  classSlugs: string[];
  sourceIds: string[];
  recommendedNextSlug: string;
  preparedBy: string;
  reviewedBy?: string;
  publishedBy?: string;
  updatedAt: string;
};
type Publication = { status: string; activeVersion: string };
type View = { key: string; plan: Plan | null; publication: Publication | null };
type Command = "prepare" | "review" | "publish" | "withdraw";

const knownClasses = classContracts.map((entry) => ({
  slug: entry.experienceSlug,
  objective: entry.objective,
}));
const scopedId = (id: string) => /^[A-Za-z0-9_-]{1,128}$/.test(id);
const versionId = (id: string) => /^[a-z][a-z0-9-]{2,95}$/.test(id);

/**
 * Remount the entire draft/editor on Firebase principal changes: no previous
 * institution's candidate, rights reference or approval remains in the UI.
 */
export function AssessmentPublicationConsole() {
  const { user } = useLumaAuth();
  return <ScopedAssessmentPublicationConsole key={user?.uid ?? "signed-out"} />;
}

function ScopedAssessmentPublicationConsole() {
  const [tenantId, setTenantId] = useState("");
  const [programId, setProgramId] = useState("");
  const [offeringId, setOfferingId] = useState("");
  const [version, setVersion] = useState("");
  const [revision, setRevision] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [nextSlug, setNextSlug] = useState("");
  const [rightsRecordId, setRightsRecordId] = useState("");
  const [rightsEvidenceSha256, setRightsEvidenceSha256] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("security-stop");
  const [view, setView] = useState<View | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const scopeKey = tenantId + ":" + programId;
  const visible = view?.key === scopeKey ? view : null;
  const canScope = scopedId(tenantId) && scopedId(programId);
  const path = () => "/api/platform/institutions/" + encodeURIComponent(tenantId) +
    "/programs/" + encodeURIComponent(programId) + "/assessment-publication";

  async function api(method: "GET" | "POST" | "PATCH", body?: object) {
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (!token) throw new Error("Inicia sesión con tu cuenta institucional para continuar.");
    const response = await fetch(path(), {
      method, cache: "no-store",
      headers: {
        authorization: "Bearer " + token,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json() as {
      plan?: Plan | null;
      publication?: Publication | null;
      receipt?: { status: PublicationStatus; appliedRevision: number };
      error?: string;
    };
    if (!response.ok) {
      const reason: Record<string, string> = {
        feature_unavailable: "El publicador institucional está desactivado en este entorno.",
        authentication_required: "Tu sesión ya no es válida. Inicia sesión de nuevo.",
        not_authorized: "Tu cuenta no tiene los permisos de esta academia o esta acción requiere otro revisor autorizado.",
        assessment_publication_conflict: "El currículo o su estado cambió. Actualiza la información antes de continuar.",
        assessment_publication_unavailable: "No fue posible verificar el registro institucional en este momento.",
      };
      throw new Error(reason[data.error ?? ""] ?? "No se pudo completar la operación. " + (data.error ?? ""));
    }
    return data;
  }
  async function refresh(forKey = scopeKey) {
    const response = await api("GET");
    setView({ key: forKey, plan: response.plan ?? null, publication: response.publication ?? null });
  }
  async function load() {
    if (!canScope || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo consultar el plan.");
    } finally { setBusy(false); }
  }
  async function mutate(action: Command) {
    if (!canScope || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const expectedPlanRevision = visible?.plan?.planRevision ?? 0;
      let body: object;
      if (action === "prepare") {
        if (!scopedId(offeringId) || !versionId(version) || !versionId(revision) ||
          selected.length === 0 || !selected.includes(nextSlug)) {
          throw new Error("Completa offering, versiones, clases y acción sugerida con valores válidos.");
        }
        body = { requestId: crypto.randomUUID(), expectedPlanRevision, offeringId,
          version, curriculumRevision: revision, classSlugs: selected,
          recommendedNextSlug: nextSlug,
          reasonCode: visible?.plan ? "curriculum-update" : "new-curriculum" };
      } else if (action === "review") {
        if (!scopedId(rightsRecordId) || !/^[a-f0-9]{64}$/.test(rightsEvidenceSha256)) {
          throw new Error("La aprobación exige una referencia documental y su SHA-256 válido.");
        }
        body = { requestId: crypto.randomUUID(), expectedPlanRevision, action: "review",
          reasonCode: "reviewed-with-rights-evidence", rightsRecordId, rightsEvidenceSha256 };
      } else if (action === "publish") {
        body = { requestId: crypto.randomUUID(), expectedPlanRevision, action: "publish",
          reasonCode: "publish-reviewed-curriculum" };
      } else {
        body = { requestId: crypto.randomUUID(), expectedPlanRevision, action: "withdraw",
          reasonCode: withdrawReason };
      }
      const result = await api(action === "prepare" ? "POST" : "PATCH", body);
      await refresh();
      setNotice("Operación registrada: " + (result.receipt?.status ?? action) +
        " · revisión " + String(result.receipt?.appliedRevision ?? ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la operación.");
    } finally { setBusy(false); }
  }

  return (
    <div className={styles.layout} data-testid="assessment-publication-console">
      <section className={styles.surface} aria-labelledby="assessment-publisher-title">
        <div className={styles.head}>
          <div className={styles.symbol}><BookOpenCheck size={24} aria-hidden="true" /></div>
          <div>
            <p className={styles.eyebrow}>CONTROL ACADÉMICO · PUBLICACIÓN</p>
            <h2 id="assessment-publisher-title">Un diagnóstico para cada programa.</h2>
            <p>Prepara una versión, solicita revisión de otro usuario y publica solamente un currículo aprobado. La publicación no certifica aprendizaje.</p>
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <label>Identificador de academia
            <input value={tenantId} onChange={e => {
              setTenantId(e.target.value); setView(null); setSelected([]); setNextSlug("");
              setNotice(""); setError(""); setRightsRecordId(""); setRightsEvidenceSha256("");
            }} placeholder="mi-academia" autoComplete="off" maxLength={128} />
          </label>
          <label>Identificador de programa
            <input value={programId} onChange={e => {
              setProgramId(e.target.value); setView(null); setSelected([]); setNextSlug("");
              setNotice(""); setError(""); setRightsRecordId(""); setRightsEvidenceSha256("");
            }} placeholder="pnl-practitioner" autoComplete="off" maxLength={128} />
          </label>
        </div>
        <button type="button" className={styles.secondary} onClick={() => void load()} disabled={!canScope || busy}>
          <RotateCcw size={16} aria-hidden="true" /> Consultar estado autorizado
        </button>
        {visible && (
          <div className={styles.status} role="status">
            <strong>Plan: {visible.plan?.status ?? "sin borrador"}</strong>
            <span>Revisión: {visible.plan?.planRevision ?? 0} · Currículo publicado: {visible.publication?.status === "published"
              ? visible.publication.activeVersion : "ninguno"}</span>
            {visible.plan && <span>Versión propuesta: {visible.plan.version} · Clases: {visible.plan.classSlugs.length}</span>}
          </div>
        )}
      </section>
      <section className={styles.surface} aria-labelledby="assessment-prepare-title">
        <p className={styles.eyebrow}>01 · ADMINISTRACIÓN</p>
        <h3 id="assessment-prepare-title">Preparar versión curricular</h3>
        <p>Los identificadores, clases y fuentes serán validados por el servidor. No se permite modificar una versión ya publicada.</p>
        <div className={styles.fieldGrid}>
          <label>Offering activo
            <input value={offeringId} onChange={e => setOfferingId(e.target.value)} placeholder="offering-id" maxLength={128} />
          </label>
          <label>Versión del assessment
            <input value={version} onChange={e => setVersion(e.target.value)} placeholder="practitioner-entry-v1" maxLength={96} />
          </label>
          <label>Revisión curricular
            <input value={revision} onChange={e => setRevision(e.target.value)} placeholder="pnl-revision-v1" maxLength={96} />
          </label>
          <label>Experiencia para continuar
            <select value={nextSlug} onChange={e => setNextSlug(e.target.value)}>
              <option value="">Selecciona una clase incluida</option>
              {knownClasses.filter(c => selected.includes(c.slug)).map(c => (
                <option value={c.slug} key={c.slug}>{c.slug}</option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className={styles.classes}>
          <legend>Clases autorizadas en este assessment</legend>
          {knownClasses.map(c => (
            <label key={c.slug}>
              <input type="checkbox" checked={selected.includes(c.slug)} onChange={e => {
                setSelected(previous => e.target.checked ? [...previous, c.slug] : previous.filter(x => x !== c.slug));
                if (!e.target.checked && nextSlug === c.slug) setNextSlug("");
              }} />
              <span><strong>{c.slug}</strong><small>{c.objective}</small></span>
            </label>
          ))}
        </fieldset>
        <button type="button" className={styles.primary} onClick={() => void mutate("prepare")}
          disabled={!canScope || !visible || busy || (visible.plan !== null && !["published","withdrawn"].includes(visible.plan.status))}>
          Preparar currículo <ArrowRight size={16} aria-hidden="true" />
        </button>
      </section>
      <section className={styles.surface} aria-labelledby="assessment-review-title">
        <p className={styles.eyebrow}>02 · SEGUNDA PERSONA AUTORIZADA</p>
        <h3 id="assessment-review-title">Revisar documentación y aprobar</h3>
        <p>La cuenta revisora necesita permisos institucionales y <code>assessmentReviewer</code>. La misma persona que preparó no puede aprobar.</p>
        <div className={styles.fieldGrid}>
          <label>Referencia de evidencia de derechos
            <input value={rightsRecordId} onChange={e => setRightsRecordId(e.target.value)} placeholder="legal-dossier-2026" maxLength={128} />
          </label>
          <label>SHA-256 de la evidencia documental
            <input value={rightsEvidenceSha256} onChange={e => setRightsEvidenceSha256(e.target.value.trim().toLowerCase())}
              placeholder="64 caracteres hexadecimales" maxLength={64} autoComplete="off" />
          </label>
        </div>
        <p className={styles.note}><CircleAlert size={15} aria-hidden="true" /> Registrar la referencia no valida automáticamente las licencias o los derechos de terceros.</p>
        <button type="button" className={styles.secondary} onClick={() => void mutate("review")}
          disabled={!visible || visible.plan?.status !== "prepared" || busy}>
          <CheckCheck size={17} aria-hidden="true" /> Aprobar como revisor autorizado
        </button>
      </section>
      <section className={styles.surface} aria-labelledby="assessment-publish-title">
        <p className={styles.eyebrow}>03 · PUBLICACIÓN Y REVOCACIÓN</p>
        <h3 id="assessment-publish-title">Publicar o retirar sin perder el historial</h3>
        <p>Publicar exige <code>assessmentPublisher</code>, un plan revisado por otro usuario y un offering activo. Retirar deja disponible la evidencia histórica para auditoría.</p>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void mutate("publish")}
            disabled={!visible || visible.plan?.status !== "reviewed" || busy}>
            <ShieldCheck size={17} aria-hidden="true" /> Publicar versión revisada
          </button>
          <label>Motivo de retirada
            <select value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)}>
              <option value="security-stop">Incidente de seguridad</option>
              <option value="rights-revoked">Derechos retirados</option>
              <option value="curriculum-replaced">Currículo reemplazado</option>
              <option value="operator-withdrawn">Retirada administrativa</option>
            </select>
          </label>
          <button type="button" className={styles.danger} onClick={() => void mutate("withdraw")}
            disabled={!visible?.plan || visible.plan.status === "withdrawn" || busy}>
            <ShieldX size={17} aria-hidden="true" /> Retirar versión
          </button>
        </div>
        {notice && <p className={styles.success} role="status"><FileCheck2 size={17} /> {notice}</p>}
        {error && <p className={styles.error} role="alert"><CircleAlert size={17} /> {error}</p>}
        <p className={styles.note}>La autorización de este currículo es distinta de la aprobación independiente del release de LUMA. <Link href="/studio/programs">Volver a programas</Link>.</p>
      </section>
    </div>
  );
}
