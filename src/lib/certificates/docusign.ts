import { createHmac, timingSafeEqual } from "node:crypto";
import type { AcademicCertificate, CertificateIssuer } from "./domain";
import { docusignRequest } from "./docusign-auth";

export async function sendForSignature(
  certificate: AcademicCertificate,
  issuer: CertificateIssuer,
  pdf: Uint8Array,
): Promise<string> {
  const response = await docusignRequest("/envelopes", {
    method: "POST",
    body: {
      emailSubject: `Firma de certificado académico - ${certificate.programTitle}`,
      transactionId: certificate.certificateId,
      status: "sent",
      documents: [{
        documentBase64: Buffer.from(pdf).toString("base64"),
        name: `Certificado-${certificate.certificateId}.pdf`,
        fileExtension: "pdf", documentId: "1",
      }],
      recipients: { signers: [{
        email: issuer.signerEmail, name: issuer.signerName,
        recipientId: "1", routingOrder: "1",
        tabs: { signHereTabs: [{
          documentId: "1", pageNumber: "1",
          xPosition: "576", yPosition: "438",
        }] },
      }] },
      customFields: { textCustomFields: [{
        name: "lumaCertificateId", value: certificate.certificateId, show: "false",
      }] },
    },
  });
  const body = await response.json() as { envelopeId?: string; status?: string };
  if (!body.envelopeId || body.status !== "sent") {
    throw new Error("SIGNING_PROVIDER_RESPONSE_INVALID");
  }
  return body.envelopeId;
}

async function validPdf(response: Response): Promise<Buffer> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > 15_000_000) throw new Error("SIGNING_PDF_TOO_LARGE");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 100 || bytes.length > 15_000_000 ||
      bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("SIGNING_PDF_INVALID");
  return bytes;
}

export async function downloadSignedEnvelope(envelopeId: string) {
  if (!/^[A-Za-z0-9-]{10,100}$/.test(envelopeId)) {
    throw new Error("SIGNING_ENVELOPE_ID_INVALID");
  }
  const path = `/envelopes/${encodeURIComponent(envelopeId)}`;
  const response = await docusignRequest(path);
  const data = await response.json() as {
    status?: string;
    completedDateTime?: string;
  };
  if (data.status !== "completed" || !data.completedDateTime) {
    throw new Error("SIGNING_ENVELOPE_NOT_COMPLETE");
  }
  const [signed, evidence] = await Promise.all([
    docusignRequest(`${path}/documents/combined`),
    docusignRequest(`${path}/documents/certificate`),
  ]);
  const [signedPdf, evidencePdf] = await Promise.all([validPdf(signed), validPdf(evidence)]);
  return {
    signedPdf, evidencePdf,
    signedAt: new Date(data.completedDateTime).toISOString(),
  };
}

export function verifyDocusignConnectHmac(rawBody: string, header: string | null): boolean {
  const secret = process.env.DOCUSIGN_CONNECT_HMAC_SECRET;
  if (!secret || !header) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  const supplied = Buffer.from(header.trim(), "base64");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

export function parseCompletedEnvelopeEvent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as { event?: unknown; data?: { envelopeId?: unknown } };
  if (value.event !== "envelope-completed") return null;
  const id = value.data?.envelopeId;
  return typeof id === "string" && /^[A-Za-z0-9-]{10,100}$/.test(id) ? id : null;
}
