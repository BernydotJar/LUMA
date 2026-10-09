import { randomUUID, createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { firebaseAdminAuth } from "@/lib/firebase-admin";
import { commerceEnrollments } from "@/lib/commerce/server";
import { isActiveCommerceEnrollment } from "@/lib/commerce/enrollment";
import type { LearningCoachAccess } from "@/lib/coach-access";
import type { ProgramOffering } from "@/lib/program-delivery";
import { sendForSignature, downloadSignedEnvelope } from "./docusign";
import { signCertificateWithStirling, loadStirlingConfig } from "./stirling";
import { renderCertificatePdf, certificateBaseUrl } from "./pdf";
import {
  canManageCertificates, cleanText, completionId, documentId, normalizedEmail,
  validateAttestation, type AcademicCertificate, type CertificateIssuer,
  type CompletionAttestation,
} from "./domain";

type Coach = { uid: string; access: LearningCoachAccess };
const clock = () => new Date().toISOString();

export class CertificateService {
  constructor(private readonly firestore: Firestore) {}

  private certificate(id: string) {
    return this.firestore.collection("academicCertificates").doc(documentId(id, "certificate_id"));
  }
  private completion(id: string) {
    return this.firestore.collection("academicCompletions").doc(id);
  }
  private issuer(id: string) {
    return this.firestore.collection("academicCertificateIssuers").doc(documentId(id, "tenant_id"));
  }
  private storage() {
    const name = process.env.CERTIFICATE_STORAGE_BUCKET;
    if (!name || !/^[a-z0-9][a-z0-9.-]{2,100}$/.test(name)) {
      throw new Error("CERTIFICATE_STORAGE_NOT_CONFIGURED");
    }
    return getStorage().bucket(name);
  }
  private async putEvidence(path: string, evidence: unknown) {
    const payload = Buffer.from(JSON.stringify(evidence), "utf8");
    if (payload.length > 64_000) throw new Error("CERTIFICATE_EVIDENCE_TOO_LARGE");
    await this.storage().file(path).save(payload, {
      resumable: false, contentType: "application/json",
      metadata: { cacheControl: "private, no-store" },
    });
  }
  private async putPdf(path: string, pdf: Uint8Array) {
    if (pdf.length > 15_000_000 || Buffer.from(pdf).subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("CERTIFICATE_INVALID_PDF");
    }
    await this.storage().file(path).save(Buffer.from(pdf), {
      resumable: false,
      contentType: "application/pdf",
      metadata: { cacheControl: "private, no-store" },
    });
  }
  async pdfForLearner(id: string, learnerId: string): Promise<Buffer> {
    const record = await this.get(id);
    if (!record || record.learnerId !== learnerId ||
        record.status !== "signed" || !record.signedStoragePath) {
      throw new Error("CERTIFICATE_NOT_ACCESSIBLE");
    }
    const [bytes] = await this.storage().file(record.signedStoragePath).download();
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== record.signedSha256) throw new Error("CERTIFICATE_ARCHIVE_INTEGRITY_FAILED");
    return bytes;
  }
  async get(id: string): Promise<AcademicCertificate | undefined> {
    const snapshot = await this.certificate(id).get();
    return snapshot.exists ? snapshot.data() as AcademicCertificate : undefined;
  }
  async mine(learnerId: string): Promise<AcademicCertificate[]> {
    const snapshot = await this.firestore.collection("academicCertificates")
      .where("learnerId", "==", documentId(learnerId, "learner_id"))
      .limit(100).get();
    return snapshot.docs.map(doc => doc.data() as AcademicCertificate)
      .filter(item => item.status === "signed" || item.status === "revoked")
      .sort((a,b) => b.issuedAt.localeCompare(a.issuedAt));
  }
  async offering(id: string): Promise<ProgramOffering> {
    const snapshot = await this.firestore.collection("programOfferings")
      .doc(documentId(id, "offering_id")).get();
    if (!snapshot.exists) throw new Error("CERTIFICATE_OFFERING_NOT_FOUND");
    const offering = snapshot.data() as ProgramOffering;
    if (offering.offeringId !== id) throw new Error("CERTIFICATE_OFFERING_CONFLICT");
    return offering;
  }
  async authorizedOffering(coach: Coach, id: string, learnerId?: string) {
    const offering = await this.offering(id);
    if (!canManageCertificates(coach.access, coach.uid, offering, learnerId)) {
      throw new Error("CERTIFICATE_FORBIDDEN");
    }
    if (!["active", "completed"].includes(offering.status)) {
      throw new Error("CERTIFICATE_OFFERING_NOT_COMPLETABLE");
    }
    return offering;
  }
  async configureIssuer(input: {
    tenantId: unknown; legalName: unknown; signerName: unknown; signerEmail: unknown;
    institutionalSigningAuthorized?: unknown;
  }, adminUid: string) {
    const tenantId = documentId(input.tenantId, "tenant_id");
    const record: CertificateIssuer = {
      tenantId, legalName: cleanText(input.legalName, "legal_name"),
      signerName: cleanText(input.signerName, "signer_name"),
      signerEmail: normalizedEmail(input.signerEmail),
      updatedBy: adminUid, updatedAt: clock(),
      ...(input.institutionalSigningAuthorized === true ? {
        institutionalSigningAuthorizedAt: clock(),
        institutionalSigningAuthorizedBy: adminUid,
      } : {}),
    };
    await this.issuer(tenantId).set(record);
    await this.issuer(tenantId).collection("events").add({
      type: "issuer_updated", actor: adminUid, at: clock(),
      institutionalSigningAuthorized: Boolean(record.institutionalSigningAuthorizedAt),
    });
    return record;
  }
  async getIssuer(tenantId: string) {
    const snapshot = await this.issuer(tenantId).get();
    if (!snapshot.exists) throw new Error("CERTIFICATE_ISSUER_NOT_CONFIGURED");
    return snapshot.data() as CertificateIssuer;
  }
  async approveCompletion(
    coach: Coach,
    input: {
      offeringId: unknown; learnerId: unknown;
      learnerLegalName: unknown; identityConfirmed: unknown;
      rationale: unknown; evidenceEventIds?: unknown;
    },
  ) {
    const learnerId = documentId(input.learnerId, "learner_id");
    const offeringId = documentId(input.offeringId, "offering_id");
    const offering = await this.authorizedOffering(coach, offeringId, learnerId);
    const { rationale, evidenceEventIds, learnerLegalName } = validateAttestation(input);
    const enrollments = await commerceEnrollments.listByLearner(learnerId);
    if (!enrollments.some(row => row.tenantId === offering.tenantId &&
        row.programId === offering.programId && row.offeringId === offeringId &&
        isActiveCommerceEnrollment(row))) {
      throw new Error("CERTIFICATE_ENROLLMENT_REQUIRED");
    }
    // User-provided event IDs are never trusted without ownership verification.
    if (evidenceEventIds.length) {
      const refs = evidenceEventIds.map(id =>
        this.firestore.collection("learners").doc(learnerId).collection("events").doc(id));
      const snapshots = await this.firestore.getAll(...refs);
      if (snapshots.some(snapshot => !snapshot.exists || snapshot.data()?.learnerId !== learnerId)) {
        throw new Error("CERTIFICATE_EVIDENCE_NOT_FOUND");
      }
    }
    const id = completionId(offering.tenantId, offeringId, learnerId);
    const ref = this.completion(id);
    return this.firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (snapshot.exists) {
        const current = snapshot.data() as CompletionAttestation;
        if (current.rationale !== rationale ||
            current.learnerLegalName !== learnerLegalName ||
            JSON.stringify(current.evidenceEventIds) !== JSON.stringify(evidenceEventIds)) {
          throw new Error("CERTIFICATE_COMPLETION_ALREADY_APPROVED");
        }
        return current;
      }
      const record: CompletionAttestation = {
        completionId: id, tenantId: offering.tenantId, offeringId,
        programId: offering.programId, learnerId, rationale, evidenceEventIds,
        approvedBy: coach.uid, identityAttestedBy: coach.uid,
        learnerLegalName, approvedAt: clock(),
      };
      tx.create(ref, record);
      return record;
    });
  }
  async issue(coach: Coach, input: { offeringId: unknown; learnerId: unknown }) {
    const learnerId = documentId(input.learnerId, "learner_id");
    const offeringId = documentId(input.offeringId, "offering_id");
    const offering = await this.authorizedOffering(coach, offeringId, learnerId);
    const issuer = await this.getIssuer(offering.tenantId);
    const provider = process.env.CERTIFICATE_SIGNING_PROVIDER ?? "stirling";
    if (provider !== "stirling" && provider !== "docusign") {
      throw new Error("CERTIFICATE_SIGNING_PROVIDER_INVALID");
    }
    if (provider === "stirling" && (!issuer.institutionalSigningAuthorizedAt ||
        !issuer.institutionalSigningAuthorizedBy)) {
      throw new Error("CERTIFICATE_INSTITUTIONAL_SIGNING_NOT_AUTHORIZED");
    }
    // Validate tenant-specific keystore, certificate validity, network endpoint and
    // trust policy before reserving an immutable certificate ID.
    const stirlingConfig = provider === "stirling"
      ? await loadStirlingConfig(offering.tenantId) : null;
    if (stirlingConfig &&
        stirlingConfig.issuerLegalName.toLocaleLowerCase().trim() !==
          issuer.legalName.toLocaleLowerCase().trim()) {
      throw new Error("STIRLING_ISSUER_NOT_AUTHORIZED");
    }
    const enrollments = await commerceEnrollments.listByLearner(learnerId);
    if (!enrollments.some(enrollment =>
      enrollment.tenantId === offering.tenantId &&
      enrollment.programId === offering.programId &&
      enrollment.offeringId === offeringId &&
      isActiveCommerceEnrollment(enrollment))) {
      throw new Error("CERTIFICATE_ENROLLMENT_REQUIRED");
    }
    // Email control is verified independently; academic legal name was frozen
    // during the responsible coach's completion/identity attestation.
    const learner = await firebaseAdminAuth.getUser(learnerId);
    if (!learner.emailVerified) {
      throw new Error("CERTIFICATE_VERIFIED_LEARNER_IDENTITY_REQUIRED");
    }
    // Fail early on missing public verification origin or private artifact store.
    certificateBaseUrl();
    this.storage();
    const completionKey = completionId(offering.tenantId, offeringId, learnerId);
    const ref = this.completion(completionKey);
    const now = clock();
    const reserved = await this.firestore.runTransaction(async tx => {
      if (provider === "stirling") {
        const latestIssuer = await tx.get(this.issuer(offering.tenantId));
        const value = latestIssuer.data() as CertificateIssuer | undefined;
        if (!latestIssuer.exists || !value?.institutionalSigningAuthorizedAt ||
            value.updatedAt !== issuer.updatedAt) {
          throw new Error("CERTIFICATE_INSTITUTIONAL_SIGNING_NOT_AUTHORIZED");
        }
      }
      const approved = await tx.get(ref);
      if (!approved.exists) throw new Error("CERTIFICATE_COMPLETION_REQUIRED");
      const current = approved.data() as CompletionAttestation;
      if (current.tenantId !== offering.tenantId ||
          current.offeringId !== offeringId || current.learnerId !== learnerId ||
          !current.learnerLegalName || !current.identityAttestedBy) {
        throw new Error("CERTIFICATE_COMPLETION_CONFLICT");
      }
      if (current.certificateId) {
        const previous = await tx.get(this.certificate(current.certificateId));
        if (!previous.exists) throw new Error("CERTIFICATE_ARCHIVE_INCONSISTENT");
        return { record: previous.data() as AcademicCertificate, created: false };
      }
      const certificateId = randomUUID();
      const record: AcademicCertificate = {
        certificateId, completionId: completionKey, tenantId: offering.tenantId,
        offeringId, programId: offering.programId, learnerId,
        learnerName: cleanText(current.learnerLegalName, "learner_legal_name", 120),
        programTitle: offering.title, issuerLegalName: issuer.legalName,
        signerName: issuer.signerName, signerEmail: issuer.signerEmail,
        provider, status: "preparing",
        issuedAt: now, updatedAt: now, issuedBy: coach.uid,
      };
      tx.create(this.certificate(certificateId), record);
      tx.update(ref, { certificateId });
      return { record, created: true };
    });
    if (!reserved.created) return reserved.record;

    const record = reserved.record;
    try {
      const unsignedPdf = await renderCertificatePdf(record);
      const unsignedStoragePath =
        `academic-certificates/${record.tenantId}/${record.certificateId}/unsigned.pdf`;
      await this.putPdf(unsignedStoragePath, unsignedPdf);
      if (provider === "stirling" && stirlingConfig) {
        // Stop before releasing the institutional key if an admin changed the issuer.
        const currentIssuer = await this.getIssuer(offering.tenantId);
        if (!currentIssuer.institutionalSigningAuthorizedAt ||
            currentIssuer.updatedAt !== issuer.updatedAt) {
          throw new Error("CERTIFICATE_INSTITUTIONAL_SIGNING_NOT_AUTHORIZED");
        }
        const signed = await signCertificateWithStirling(record, unsignedPdf, stirlingConfig);
        const root = "academic-certificates/" + record.tenantId + "/" + record.certificateId;
        const signedStoragePath = root + "/signed.pdf";
        const evidenceStoragePath = root + "/signature-validation.json";
        const evidenceBytes = Buffer.from(JSON.stringify(signed.evidence), "utf8");
        await Promise.all([
          this.putPdf(signedStoragePath, signed.signedPdf),
          this.putEvidence(evidenceStoragePath, signed.evidence),
        ]);
        const signatureEvidenceSha256 = createHash("sha256").update(evidenceBytes).digest("hex");
        return this.firestore.runTransaction(async tx => {
          const certificateRef = this.certificate(record.certificateId);
          const current = await tx.get(certificateRef);
          if (!current.exists) throw new Error("CERTIFICATE_NOT_FOUND");
          const latest = current.data() as AcademicCertificate;
          if (latest.status !== "preparing" || latest.provider !== "stirling") {
            throw new Error("CERTIFICATE_INVALID_STATE");
          }
          const updatedAt = clock();
          const result: AcademicCertificate = {
            ...latest, status: "signed", signedAt: signed.signedAt,
            updatedAt, unsignedStoragePath, signedStoragePath, evidenceStoragePath,
            signedSha256: signed.signedSha256,
            signatureEvidenceSha256,
            signerCertificateSerial: signed.evidence.signerCertificateSerial,
          };
          tx.update(certificateRef, {
            status: result.status, signedAt: result.signedAt,
            updatedAt: result.updatedAt, unsignedStoragePath,
            signedStoragePath, evidenceStoragePath,
            signedSha256: result.signedSha256, signatureEvidenceSha256,
            signerCertificateSerial: result.signerCertificateSerial,
          });
          tx.create(certificateRef.collection("events").doc("institutional-signature"), {
            type: "institutional_signature_validated",
            at: updatedAt, actor: coach.uid, provider: "stirling",
            signedSha256: result.signedSha256,
            certificateSerial: result.signerCertificateSerial,
            validationEvidenceSha256: signatureEvidenceSha256,
            signingAuthorizedBy: issuer.institutionalSigningAuthorizedBy,
          });
          return result;
        });
      }
      const envelopeId = await sendForSignature(record, issuer, unsignedPdf);
      await this.certificate(record.certificateId).update({
        status: "pending_signature", envelopeId, unsignedStoragePath, updatedAt: clock(),
      });
      await this.certificate(record.certificateId).collection("events").add({
        type: "signature_requested", at: clock(), actor: coach.uid,
        envelopeId, completionId: completionKey,
      });
      return { ...record, status: "pending_signature" as const,
        unsignedStoragePath, envelopeId };
    } catch (error) {
      // No automatic retries: the provider may have accepted the envelope.
      const certificateRef = this.certificate(record.certificateId);
      await this.firestore.runTransaction(async tx => {
        const snapshot = await tx.get(certificateRef);
        if (!snapshot.exists) return;
        const current = snapshot.data() as AcademicCertificate;
        if (current.status !== "preparing" && current.status !== "pending_signature") return;
        tx.update(certificateRef, {
          status: "failed", updatedAt: clock(),
          errorCode: "SIGNING_REQUIRES_RECONCILIATION",
        });
      });
      throw error;
    }
  }
  async finalizeEnvelope(envelopeId: string) {
    const snapshot = await this.firestore.collection("academicCertificates")
      .where("envelopeId", "==", envelopeId).limit(2).get();
    if (snapshot.empty) throw new Error("CERTIFICATE_ENVELOPE_NOT_FOUND");
    if (snapshot.size > 1) throw new Error("CERTIFICATE_ENVELOPE_COLLISION");
    const ref = snapshot.docs[0].ref;
    const record = snapshot.docs[0].data() as AcademicCertificate;
    if (record.status === "signed" || record.status === "revoked") return record;
    if (record.status !== "pending_signature" || record.provider !== "docusign") {
      throw new Error("CERTIFICATE_INVALID_STATE");
    }
    const files = await downloadSignedEnvelope(envelopeId);
    const root = `academic-certificates/${record.tenantId}/${record.certificateId}`;
    const signedStoragePath = `${root}/signed.pdf`;
    const evidenceStoragePath = `${root}/signature-evidence.pdf`;
    await Promise.all([
      this.putPdf(signedStoragePath, files.signedPdf),
      this.putPdf(evidenceStoragePath, files.evidencePdf),
    ]);
    const signedSha256 = createHash("sha256").update(files.signedPdf).digest("hex");
    return this.firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error("CERTIFICATE_NOT_FOUND");
      const current = snapshot.data() as AcademicCertificate;
      if (current.envelopeId !== envelopeId) throw new Error("CERTIFICATE_ENVELOPE_CONFLICT");
      if (current.status !== "pending_signature") return current;
      const updated: AcademicCertificate = {
        ...current, status: "signed", signedAt: files.signedAt,
        signedStoragePath, evidenceStoragePath, signedSha256, updatedAt: clock(),
      };
      tx.update(ref, {
        status: updated.status, signedAt: updated.signedAt,
        signedStoragePath, evidenceStoragePath, signedSha256,
        updatedAt: updated.updatedAt,
      });
      tx.create(ref.collection("events").doc(`signed-${envelopeId}`), {
        type: "signature_verified_and_archived", at: updated.updatedAt,
        envelopeId, signedSha256, signedAt: updated.signedAt,
      });
      return updated;
    });
  }

  async revoke(id: string, adminUid: string, reason: unknown) {
    const explanation = cleanText(reason, "revocation_reason", 500);
    if (explanation.length < 15) throw new Error("CERTIFICATE_REVOCATION_REASON_TOO_SHORT");
    const ref = this.certificate(id);
    return this.firestore.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) throw new Error("CERTIFICATE_NOT_FOUND");
      const record = snapshot.data() as AcademicCertificate;
      if (record.status === "revoked") return record;
      if (record.status !== "signed") throw new Error("CERTIFICATE_NOT_SIGNED");
      const at = clock();
      tx.update(ref, {
        status: "revoked", revokedBy: adminUid,
        revokedAt: at, revocationReason: explanation, updatedAt: at,
      });
      tx.create(ref.collection("events").doc(`revoke-${randomUUID()}`), {
        type: "revocation", actor: adminUid, at, reason: explanation,
      });
      return { ...record, status: "revoked" as const,
        revokedBy: adminUid, revokedAt: at, revocationReason: explanation };
    });
  }
}
