import { MAX_INSTITUTIONAL_BATCH } from "./institutional-limits";

const MAX_TEXT_LENGTH = 32_768;

/**
 * Interprets copied email columns or UTF-8 CSV/TSV with a header named
 * `email`, `correo` or `correo_electronico`. Quoted CSV cells are supported.
 * No spreadsheet formulas or extra metadata are ever sent to the enrollment API.
 */
export function parseInstitutionalEmailList(source: string): string[] {
  if (typeof source !== "string" || source.length > MAX_TEXT_LENGTH) {
    throw new Error("INSTITUTIONAL_IMPORT_TOO_LARGE");
  }
  const text = source.replace(/^\uFEFF/, "").trim();
  if (!text) return [];

  const header = text.split(/\r?\n/, 1)[0];
  const delimiter = header.includes("\t") ? "\t" :
    header.includes(";") ? ";" : ",";

  const records: string[][] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;
  let startOfField = true;

  function pushField() {
    cells.push(field);
    field = "";
    startOfField = true;
    afterQuote = false;
  }
  function pushRow() {
    pushField();
    if (cells.some(cell => cell.trim())) records.push(cells);
    cells = [];
    if (records.length > MAX_INSTITUTIONAL_BATCH + 1) {
      throw new Error("INSTITUTIONAL_IMPORT_TOO_MANY");
    }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else field += char;
      continue;
    }
    if (char === '"' && startOfField) {
      quoted = true;
      startOfField = false;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\r" || char === "\n") {
      pushRow();
      if (char === "\r" && text[i + 1] === "\n") i++;
    } else if (char === '"' || (afterQuote && char.trim() !== "")) {
      throw new Error("INSTITUTIONAL_IMPORT_MALFORMED_CSV");
    } else {
      field += char;
      if (char.trim()) startOfField = false;
    }
  }
  if (quoted) throw new Error("INSTITUTIONAL_IMPORT_MALFORMED_CSV");
  pushRow();

  const first = records[0] ?? [];
  const normalizedHeaders = first.map(cell =>
    cell.trim().toLowerCase().normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_"));
  const emailIndex = normalizedHeaders.findIndex(name =>
    ["email", "correo", "correo_electronico", "email_address"].includes(name));

  const emails = emailIndex >= 0
    ? records.slice(1).map(row => {
      if (row.length <= emailIndex) throw new Error("INSTITUTIONAL_IMPORT_MISSING_COLUMN");
      return row[emailIndex].trim();
    })
    : records.map(row => {
      if (row.length !== 1) throw new Error("INSTITUTIONAL_IMPORT_EMAIL_COLUMN_REQUIRED");
      return row[0].trim();
    });

  if (emails.length > MAX_INSTITUTIONAL_BATCH) {
    throw new Error("INSTITUTIONAL_IMPORT_TOO_MANY");
  }
  return emails;
}
