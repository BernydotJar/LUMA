import { createHash } from "node:crypto";
import { validLearningScopeId } from "@/lib/learning-entitlement";
import { assertTenantAdmin } from "@/lib/tenant-admin-access";

export interface InstitutionalGrantRequest {
  tenantId: string;
  programId: string;
  offeringId: string;
  email: string;
  reason: string;
  expiresAt: string;
  allowReactivation: boolean;
}

export type InstitutionalEnrollmentStatus = "active" | "revoked";

export function enrollmentIdForGrant(
  grant: Pick<InstitutionalGrantRequest, "tenantId" | "programId" | "offeringId" | "email">,
): string {
  return createHash("sha256")
    .update(JSON.stringify(["institutional", grant.tenantId, grant.programId, grant.offeringId, grant.email.toLowerCase()]))
    .digest("hex");
}

export function parseInstitutionalGrant(input: unknown, now = Date.now()): InstitutionalGrantRequest {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("INSTITUTIONAL_INPUT_INVALID");
  }
  const raw = input as Record<string, unknown>;
  const ids = ["tenantId", "programId", "offeringId"] as const;
  for (const field of ids) {
    if (!validLearningScopeId(raw[field]) ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(raw[field] as string)) {
      throw new Error("INSTITUTIONAL_SCOPE_INVALID");
    }
  }
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("INSTITUTIONAL_EMAIL_INVALID");
  }
  const reason = typeof raw.reason === "string" ? raw.reason.trim().replace(/\s+/g, " ") : "";
  if (reason.length < 20 || reason.length > 500 || /[\x00-\x1f\x7f]/.test(reason)) {
    throw new Error("INSTITUTIONAL_REASON_INVALID");
  }
  const expiresAt = typeof raw.expiresAt === "string" ? raw.expiresAt : "";
  const expiry = Date.parse(expiresAt);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(expiresAt) ||
      !Number.isFinite(expiry) || expiry <= now + 60_000 ||
      expiry > now + 2 * 366 * 24 * 60 * 60 * 1000) {
    throw new Error("INSTITUTIONAL_EXPIRY_INVALID");
  }
  if (raw.allowReactivation !== undefined && typeof raw.allowReactivation !== "boolean") {
    throw new Error("INSTITUTIONAL_REACTIVATION_INVALID");
  }
  return {
    tenantId: raw.tenantId as string,
    programId: raw.programId as string,
    offeringId: raw.offeringId as string,
    email, reason,
    expiresAt: new Date(expiry).toISOString(),
    allowReactivation: raw.allowReactivation === true,
  };
}

/** Only a platform superuser or a tenant-scoped admin may issue/revoke grants. */
export function authorizeInstitutionalAdmin(claims: Record<string, unknown>, tenantId: string): void {
  try {
    assertTenantAdmin(claims, tenantId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "TENANT_ADMIN_REQUIRED") throw new Error("INSTITUTIONAL_ADMIN_REQUIRED");
    if (message === "TENANT_ADMIN_FORBIDDEN") throw new Error("INSTITUTIONAL_TENANT_FORBIDDEN");
    throw new Error("INSTITUTIONAL_SCOPE_INVALID");
  }
}

export function parseInstitutionalRevocationReason(value: unknown) {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < 20 || reason.length > 500 || /[\x00-\x1f\x7f]/.test(reason)) {
    throw new Error("INSTITUTIONAL_REASON_INVALID");
  }
  return reason;
}
