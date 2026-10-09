import {
  parseInstitutionalGrant, type InstitutionalGrantRequest,
} from "./institutional-grants";

import { MAX_INSTITUTIONAL_BATCH } from "./institutional-limits";
export { MAX_INSTITUTIONAL_BATCH, MAX_INSTITUTIONAL_BODY_BYTES } from "./institutional-limits";
const CONCURRENT_GRANTS = 4;

type InstitutionalBulkShared = Omit<InstitutionalGrantRequest, "email">;

export interface InstitutionalBulkInput {
  shared: InstitutionalBulkShared;
  emails: unknown[];
}

export type InstitutionalBulkRowStatus =
  | "granted" | "extended" | "reactivated" | "unchanged"
  | "duplicate_input" | "invalid" | "rejected";

export interface InstitutionalBulkRow {
  row: number;
  email: string;
  status: InstitutionalBulkRowStatus;
  enrollmentId?: string;
  error?: string;
}

export interface InstitutionalBulkResult {
  rows: InstitutionalBulkRow[];
  summary: {
    requested: number;
    granted: number;
    extended: number;
    reactivated: number;
    unchanged: number;
    duplicate_input: number;
    invalid: number;
    rejected: number;
  };
}

type GrantResult = {
  action: "granted" | "extended" | "reactivated" | "unchanged";
  record: { enrollmentId: string };
};
export interface BulkGrantWriter {
  grant(grant: InstitutionalGrantRequest, actorUid: string): Promise<GrantResult>;
}

/** Shape, batch bound and shared scope are validated before any mutation. */
export function parseInstitutionalBulkInput(raw: unknown, now = Date.now()): InstitutionalBulkInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("INSTITUTIONAL_BATCH_INVALID");
  }
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.emails) ||
      value.emails.length === 0 || value.emails.length > MAX_INSTITUTIONAL_BATCH) {
    throw new Error("INSTITUTIONAL_BATCH_SIZE_INVALID");
  }

  const normalized = parseInstitutionalGrant({
    tenantId: value.tenantId, programId: value.programId,
    offeringId: value.offeringId, email: "batch-validation@example.org",
    reason: value.reason, expiresAt: value.expiresAt,
    allowReactivation: value.allowReactivation,
  }, now);
  const { email: _discardEmail, ...shared } = normalized;
  void _discardEmail;
  return { shared, emails: value.emails };
}

function rejectReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "INSTITUTIONAL_ACTIVE_CONFLICT" ||
      message === "INSTITUTIONAL_REACTIVATION_CONFIRMATION_REQUIRED" ||
      message === "INSTITUTIONAL_GRANT_CONFLICT" ||
      message === "INSTITUTIONAL_OFFERING_NOT_ACTIVE") {
    return message.toLowerCase();
  }
  return "grant_unavailable";
}

/**
 * Processes bounded, independent Firestore transactions. It never forges
 * provider events and always returns per-row outcomes when some writes fail.
 * A request replay is safe because enrollment IDs and expiries are stable.
 */
export async function runInstitutionalBulk(
  input: InstitutionalBulkInput,
  actorUid: string,
  writer: BulkGrantWriter,
): Promise<InstitutionalBulkResult> {
  const rows: InstitutionalBulkRow[] = new Array(input.emails.length);
  const pending: { row: number; grant: InstitutionalGrantRequest }[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < input.emails.length; index++) {
    const original = input.emails[index];
    const row = index + 1;
    try {
      const grant = parseInstitutionalGrant({ ...input.shared, email: original });
      if (seen.has(grant.email)) {
        rows[index] = { row, email: grant.email, status: "duplicate_input" };
      } else {
        seen.add(grant.email);
        pending.push({ row, grant });
      }
    } catch {
      rows[index] = {
        row,
        email: typeof original === "string" ? original.trim().slice(0, 254) : "",
        status: "invalid",
        error: "invalid_email",
      };
    }
  }

  let next = 0;
  async function processOneWorker(): Promise<void> {
    while (next < pending.length) {
      const item = pending[next++];
      try {
        const result = await writer.grant(item.grant, actorUid);
        rows[item.row - 1] = {
          row: item.row, email: item.grant.email,
          status: result.action,
          enrollmentId: result.record.enrollmentId,
        };
      } catch (error) {
        rows[item.row - 1] = {
          row: item.row, email: item.grant.email,
          status: "rejected", error: rejectReason(error),
        };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENT_GRANTS, pending.length) },
    () => processOneWorker()));

  const summary: InstitutionalBulkResult["summary"] = {
    requested: rows.length,
    granted: 0, extended: 0, reactivated: 0,
    unchanged: 0, duplicate_input: 0, invalid: 0, rejected: 0,
  };
  for (const row of rows) summary[row.status]++;
  return { rows, summary };
}
