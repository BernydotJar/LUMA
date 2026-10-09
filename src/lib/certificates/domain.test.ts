import { describe, expect, it } from "vitest";
import {
  canManageCertificates, completionId, documentId,
  publicCertificateState, validateAttestation,
  type AcademicCertificate,
} from "./domain";
import type { ProgramOffering } from "@/lib/program-delivery";

const offering: ProgramOffering = {
  offeringId: "cohort-1", tenantId: "tenant-a", programId: "leadership",
  cohortKey: "2026", title: "Programa de Liderazgo", deliveryMode: "live",
  timezone: "America/Bogota", status: "completed", coachIds: ["coach-a"],
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-09T00:00:00Z",
};
const cert: AcademicCertificate = {
  certificateId: "cert-1", completionId: "completion-1", tenantId: "tenant-a",
  offeringId: "cohort-1", programId: "leadership", learnerId: "secret-uid",
  learnerName: "María Gómez", programTitle: "Programa de Liderazgo",
  issuerLegalName: "Institución A", signerName: "Directora Académica",
  signerEmail: "director@example.com", provider: "docusign", status: "signed",
  issuedAt: "2026-10-09T12:00:00Z", updatedAt: "2026-10-09T13:00:00Z",
  issuedBy: "coach-a", envelopeId: "envelope-1", signedAt: "2026-10-09T13:00:00Z",
  signedSha256: "abc", signedStoragePath: "private/path",
};
describe("academic certificates authorization and verification", () => {
  it("refuses cross-tenant and cross-cohort authority", () => {
    expect(canManageCertificates({ unrestricted: false, tenantIds: ["tenant-a"], learnerIds: [] },
      "other-coach", offering)).toBe(false);
    expect(canManageCertificates({ unrestricted: false, tenantIds: ["tenant-b"], learnerIds: [] },
      "coach-a", offering)).toBe(false);
    expect(canManageCertificates({ unrestricted: false, tenantIds: ["tenant-a"], learnerIds: [] },
      "coach-a", offering)).toBe(true);
  });
  it("rejects invalid IDs and unsupported approval evidence", () => {
    expect(() => documentId("../tenant", "tenant")).toThrow();
    expect(() => validateAttestation({
      rationale: "The participant met the required outcomes, reviewed individually.",
      learnerLegalName: "María Gómez", identityConfirmed: false,
    })).toThrow("CERTIFICATE_IDENTITY_ATTESTATION_REQUIRED");
    expect(() => validateAttestation({ rationale: "pass", learnerLegalName: "María Gómez", identityConfirmed: true })).toThrow();
    expect(() => validateAttestation({
      rationale: "The participant met the required outcomes, reviewed individually.",
      learnerLegalName: "María Gómez", identityConfirmed: true,
      evidenceEventIds: ["valid", "../invalid"],
    })).toThrow();
  });
  it("isolates approvals by tenant", () => {
    expect(completionId("tenant-a", "o1", "u")).not.toBe(completionId("tenant-b", "o1", "u"));
  });
  it("does not publish pending credentials or expose private references", () => {
    expect(publicCertificateState({ ...cert, status: "pending_signature" })).toBeNull();
    const verification = publicCertificateState(cert);
    expect(verification).toMatchObject({ status: "valid", learnerName: "María Gómez" });
    expect(JSON.stringify(verification)).not.toContain("secret-uid");
    expect(JSON.stringify(verification)).not.toContain("private/path");
    expect(publicCertificateState({ ...cert, status: "revoked" })).toMatchObject({ status: "revoked" });
  });
});
