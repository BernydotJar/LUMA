import { createHash } from "node:crypto";
import type { LearningCoachAccess } from "@/lib/coach-access";
import type { ProgramOffering } from "@/lib/program-delivery";

export type CertificateStatus = "preparing" | "pending_signature" | "signed" | "failed" | "revoked";

export interface CertificateIssuer {
  tenantId: string;
  legalName: string;
  signerName: string;
  signerEmail: string;
  updatedBy: string;
  updatedAt: string;
}

export interface CompletionAttestation {
  completionId: string;
  tenantId: string;
  offeringId: string;
  programId: string;
  learnerId: string;
  approvedBy: string;
  learnerLegalName: string;
  identityAttestedBy: string;
  rationale: string;
  evidenceEventIds: string[];
  approvedAt: string;
  certificateId?: string;
}

export interface AcademicCertificate {
  certificateId: string;
  completionId: string;
  tenantId: string;
  offeringId: string;
  programId: string;
  learnerId: string;
  learnerName: string;
  programTitle: string;
  issuerLegalName: string;
  signerName: string;
  signerEmail: string;
  provider: "docusign";
  status: CertificateStatus;
  issuedAt: string;
  updatedAt: string;
  issuedBy: string;
  envelopeId?: string;
  unsignedStoragePath?: string;
  signedStoragePath?: string;
  evidenceStoragePath?: string;
  signedSha256?: string;
  signedAt?: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  errorCode?: string;
}

export function documentId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new Error(`CERTIFICATE_INVALID_${label.toUpperCase()}`);
  }
  return value;
}

export function cleanText(value: unknown, label: string, max = 180): string {
  if (typeof value !== "string") throw new Error(`CERTIFICATE_INVALID_${label.toUpperCase()}`);
  const result = value.trim().replace(/\s+/g, " ");
  if (!result || result.length > max || /[\x00-\x1F\x7F]/.test(result)) {
    throw new Error(`CERTIFICATE_INVALID_${label.toUpperCase()}`);
  }
  return result;
}

export function normalizedEmail(value: unknown): string {
  const email = cleanText(value, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("CERTIFICATE_INVALID_EMAIL");
  return email;
}

export function completionId(tenantId: string, offeringId: string, learnerId: string): string {
  return createHash("sha256").update(JSON.stringify([tenantId, offeringId, learnerId])).digest("hex");
}

export function canManageCertificates(
  access: LearningCoachAccess,
  uid: string,
  offering: ProgramOffering,
  learnerId?: string,
): boolean {
  if (access.unrestricted) return true;
  // Cohort assignment AND explicit scope are both required.
  if (!offering.coachIds.includes(uid)) return false;
  return access.tenantIds.includes(offering.tenantId) ||
    Boolean(learnerId && access.learnerIds.includes(learnerId));
}

export function validateAttestation(input: {
  rationale: unknown;
  learnerLegalName: unknown;
  identityConfirmed: unknown;
  evidenceEventIds?: unknown;
}): Pick<CompletionAttestation, "rationale" | "evidenceEventIds" | "learnerLegalName"> {
  if (input.identityConfirmed !== true) throw new Error("CERTIFICATE_IDENTITY_ATTESTATION_REQUIRED");
  const learnerLegalName = cleanText(input.learnerLegalName, "learner_legal_name", 120);
  if (learnerLegalName.length < 4) throw new Error("CERTIFICATE_LEGAL_NAME_TOO_SHORT");
  const rationale = cleanText(input.rationale, "rationale", 2000);
  if (rationale.length < 40) throw new Error("CERTIFICATE_RATIONALE_TOO_SHORT");
  const ids = input.evidenceEventIds ?? [];
  if (!Array.isArray(ids) || ids.length > 20) throw new Error("CERTIFICATE_INVALID_EVIDENCE");
  const evidenceEventIds = [...new Set(ids.map((id) => documentId(id, "evidence")))];
  return { rationale, evidenceEventIds, learnerLegalName };
}

export function publicCertificateState(record: AcademicCertificate) {
  if (record.status !== "signed" && record.status !== "revoked") return null;
  return {
    certificateId: record.certificateId,
    status: record.status === "signed" ? "valid" : "revoked",
    learnerName: record.learnerName,
    programTitle: record.programTitle,
    issuerLegalName: record.issuerLegalName,
    issuedAt: record.issuedAt,
    signedAt: record.signedAt ?? null,
    signedSha256: record.signedSha256 ?? null,
    revokedAt: record.revokedAt ?? null,
  };
}
