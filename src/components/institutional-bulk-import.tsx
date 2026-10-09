"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { FileUp, UsersRound, ShieldCheck } from "lucide-react";
import { institutionalApi } from "@/lib/commerce/institutional-client";
import { parseInstitutionalEmailList } from "@/lib/commerce/institutional-csv";
import type { InstitutionalBulkResult, InstitutionalBulkRowStatus } from "@/lib/commerce/institutional-bulk";
import shell from "./institutional-enrollment-console.module.css";
import styles from "./institutional-bulk-import.module.css";

interface Offering {
  offeringId: string;
  programId: string;
  title: string;
  cohortKey: string;
}

const readableError: Record<string, string> = {
  institutional_import_too_large: "El archivo supera el tamaño permitido (32 KB).",
  institutional_import_too_many: "Cada importación permite hasta 100 participantes.",
  institutional_import_malformed_csv: "Revisa las comillas y las columnas del archivo CSV.",
  institutional_import_missing_column: "Algunas filas no incluyen la columna de correo.",
  institutional_import_email_column_required: "El CSV debe tener una columna «email» o «correo».",
  institutional_batch_size_invalid: "Cada operación admite entre 1 y 100 correos.",
  institutional_reactivation_confirmation_required: "Matrícula revocada: requiere reactivación expresa.",
  institutional_offering_not_active: "La cohorte ya no está activa.",
  institutional_active_conflict: "Existe una matrícula con una vigencia igual o superior.",
  invalid_email: "Correo inválido.",
  grant_unavailable: "No fue posible registrar esta fila. Puedes volver a intentar.",
};

const labelFor: Record<InstitutionalBulkRowStatus, string> = {
  granted: "Registrada",
  extended: "Vigencia ampliada",
  reactivated: "Reactivada",
  unchanged: "Ya vigente",
  duplicate_input: "Repetida en el archivo",
  invalid: "Correo inválido",
  rejected: "Requiere revisión",
};

export function InstitutionalBulkImport({
  tenantId, offerings, onCompleted,
}: {
  tenantId: string;
  offerings: Offering[];
  onCompleted: () => void;
}) {
  const [offeringId, setOfferingId] = useState("");
  const [source, setSource] = useState("");
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [allowReactivation, setAllowReactivation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InstitutionalBulkResult | null>(null);

  const candidate = useMemo(() => {
    try {
      return { emails: parseInstitutionalEmailList(source), error: "" };
    } catch (error) {
      const code = error instanceof Error ? error.message.toLowerCase() : "";
      return { emails: [], error: readableError[code] || "Archivo de importación no válido." };
    }
  }, [source]);

  const selected = offerings.find(item => item.offeringId === offeringId);
  const canSubmit = Boolean(
    selected && candidate.emails.length > 0 && !candidate.error &&
    reason.trim().length >= 20 && expiryDate && !busy,
  );
  const completed = result ? result.summary.granted + result.summary.extended +
    result.summary.reactivated : 0;

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 32_768) {
      setSource("");
      setError("El archivo supera el tamaño permitido (32 KB).");
      setResult(null);
      return;
    }
    try {
      const content = await file.text();
      setSource(content);
      setError("");
      setResult(null);
    } catch {
      setError("No fue posible leer el archivo en este navegador.");
    }
  }

  async function submit() {
    if (!canSubmit || !selected) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const expiresAt = new Date(expiryDate + "T23:59:59Z").toISOString();
      const response = await institutionalApi<InstitutionalBulkResult>(
        "/api/enrollments/institutional/bulk", {
          method: "POST",
          body: {
            tenantId,
            programId: selected.programId,
            offeringId: selected.offeringId,
            emails: candidate.emails,
            reason: reason.trim(),
            expiresAt,
            allowReactivation,
          },
        },
      );
      setResult(response);
      if (response.summary.granted + response.summary.extended +
          response.summary.reactivated > 0) {
        onCompleted();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setError(readableError[message] || message || "No fue posible procesar la importación.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={shell.panel} aria-labelledby="institutional-bulk-title">
    <div className={styles.heading}>
      <span className={styles.icon}><UsersRound size={22} /></span>
      <div>
        <span className="eyebrow">ADMISIÓN DE COHORTES</span>
        <h3 id="institutional-bulk-title">Inscripción masiva con revisión por participante</h3>
        <p>Importa un CSV o pega una columna de correos. Cada acceso conservará su justificación, vigencia y auditoría independiente.</p>
      </div>
    </div>
    <div className={styles.grid}>
      <div>
        <label htmlFor="bulk-offering">Cohorte activa</label>
        <select id="bulk-offering" value={offeringId}
          onChange={event => { setOfferingId(event.target.value); setResult(null); }}>
          <option value="">Selecciona una cohorte</option>
          {offerings.map(item => <option key={item.offeringId} value={item.offeringId}>
            {item.title} · {item.cohortKey}
          </option>)}
        </select>
        <label htmlFor="bulk-import">Correos de participantes</label>
        <textarea id="bulk-import" rows={7} value={source}
          placeholder={"email\nparticipante1@empresa.com\nparticipante2@empresa.com"}
          maxLength={32_768}
          onChange={event => { setSource(event.target.value); setResult(null); setError(""); }}/>
        <input id="bulk-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain"
          className={styles.fileInput} onChange={event => { void loadFile(event); }}/>
        <label htmlFor="bulk-file" className={styles.fileLabel}>
          <FileUp size={17} /> Importar archivo CSV o TXT
        </label>
        <p>Hasta 100 participantes por operación. Se admite encabezado «email» o «correo»; los correos repetidos se identifican automáticamente.</p>
        <div className={styles.preview} role="status" aria-live="polite">
          {candidate.error || (candidate.emails.length
            ? `${candidate.emails.length} filas identificadas para revisión y registro`
            : "Selecciona o pega una lista para ver el número de participantes.")}
        </div>
      </div>
      <div>
        <label htmlFor="bulk-expiry">Vigencia institucional hasta</label>
        <input id="bulk-expiry" type="date" value={expiryDate}
          onChange={event => { setExpiryDate(event.target.value); setResult(null); }}/>
        <label htmlFor="bulk-reason">Justificación de la admisión</label>
        <textarea id="bulk-reason" rows={5} maxLength={500} value={reason}
          placeholder="Indica el convenio, la autorización o el motivo académico que respalda estas plazas."
          onChange={event => { setReason(event.target.value); setResult(null); }}/>
        <label className={shell.checkbox}>
          <input type="checkbox" checked={allowReactivation}
            onChange={event => setAllowReactivation(event.target.checked)}/>
          <span>Confirmo que puedo reactivar matrículas previamente revocadas incluidas en este archivo.</span>
        </label>
        <p>La importación procesa registros independientes. Si alguna fila falla, las demás se conservan y el resultado especificará cuáles requieren revisión.</p>
        <button type="button" className="button-primary" disabled={!canSubmit}
          onClick={() => void submit()}>
          <ShieldCheck size={17}/> {busy ? "Registrando matrículas…" : "Registrar grupo autorizado"}
        </button>
      </div>
    </div>

    {error && <p className={styles.error} role="alert">{error}</p>}
    {result && <div className={styles.results}>
      <h4>Resultado de la operación</h4>
      <p aria-live="polite">
        {completed} matriculaciones nuevas, extendidas o reactivadas ·
        {result.summary.unchanged} ya vigentes ·
        {result.summary.duplicate_input} duplicadas ·
        {result.summary.invalid + result.summary.rejected} requieren revisión
      </p>
      <div className={styles.resultsScroll}>
        <table>
          <thead><tr><th scope="col">Fila</th><th scope="col">Correo</th>
            <th scope="col">Resultado</th><th scope="col">Detalle</th></tr></thead>
          <tbody>{result.rows.map(row => <tr key={row.row} data-status={row.status}>
            <td>{row.row}</td><td>{row.email || "—"}</td>
            <td>{labelFor[row.status]}</td><td>{row.error
              ? readableError[row.error] || "Requiere revisión administrativa."
              : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p>Si reenvías la misma lista con la misma vigencia, las matrículas ya registradas se reconocen como existentes y no generan nuevos registros.</p>
    </div>}
  </section>;
}
