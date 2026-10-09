import { createHash, X509Certificate } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import type { AcademicCertificate } from "./domain";

const MAX_PDF_BYTES = 15_000_000;
const MAX_KEYSTORE_BYTES = 1_048_576;
const MAX_VALIDATION_BYTES = 128_000;

export interface StirlingValidation {
  valid: boolean;
  chainValid: boolean;
  trustValid: boolean;
  notExpired: boolean;
  coversEntireDocument: boolean;
  revocationChecked: boolean;
  revocationStatus: string;
  serialNumber: string;
  subjectDN: string;
  issuerDN: string;
  selfSigned: boolean;
  signatureDate?: string | null;
}

export interface StirlingConfig {
  baseUrl: string;
  apiKey?: string;
  tenantId: string;
  issuerLegalName: string;
  p12: Buffer;
  password: string;
  expectedCertSerial: string;
  trustAnchorPem?: string;
  requireRevocation: boolean;
}

export interface InstitutionalSignature {
  signedPdf: Buffer;
  signedSha256: string;
  evidence: {
    schemaVersion: 1;
    provider: "stirling";
    certificateId: string;
    tenantId: string;
    signedSha256: string;
    unsignedSha256: string;
    signedAt: string;
    signerCertificateSerial: string;
    signerSubjectDN: string;
    signerIssuerDN: string;
    cryptographicSignatureValid: boolean;
    certificateChainTrusted: boolean;
    coversEntireDocument: boolean;
    revocationChecked: boolean;
    revocationStatus: string;
    verificationPerformedAt: string;
  };
  signedAt: string;
}

function decodeBase64(value: string | undefined, label: string): Buffer {
  if (!value || !/^[a-zA-Z0-9+/\r\n=]+$/.test(value)) {
    throw new Error(label);
  }
  const compact = value.replace(/\s/g, "");
  if (compact.length > 2_000_000) throw new Error(label);
  const data = Buffer.from(compact, "base64");
  if (data.length === 0 || data.toString("base64") !== compact) throw new Error(label);
  return data;
}

export function validateStirlingOrigin(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("STIRLING_URL_INVALID"); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("STIRLING_URL_INVALID");
  }
  if (url.protocol === "https:") return url.origin;
  // HTTP is allowed only for localhost or explicit private Docker service discovery.
  if (url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "stirling-pdf"].includes(url.hostname)) return url.origin;
  throw new Error("STIRLING_URL_INVALID");
}

export async function loadStirlingConfig(tenantId: string): Promise<StirlingConfig> {
  const baseUrl = process.env.STIRLING_PDF_BASE_URL;
  const allowedTenant = process.env.STIRLING_SIGNING_TENANT_ID;
  const issuerLegalName = process.env.STIRLING_SIGNING_LEGAL_NAME?.trim();
  const password = process.env.STIRLING_P12_PASSWORD;
  const certBase64 = process.env.STIRLING_SIGNER_CERT_PEM_BASE64;
  const keystorePath = process.env.STIRLING_P12_PATH;
  const keystoreBase64 = process.env.STIRLING_P12_BASE64;
  if (!baseUrl || !allowedTenant || !issuerLegalName || !password || !certBase64 ||
      (!keystorePath && !keystoreBase64)) {
    throw new Error("STIRLING_NOT_CONFIGURED");
  }
  if (tenantId !== allowedTenant) throw new Error("STIRLING_TENANT_NOT_AUTHORIZED");
  if (Boolean(keystorePath) === Boolean(keystoreBase64)) {
    throw new Error("STIRLING_KEYSTORE_CONFIGURATION_INVALID");
  }
  const origin = validateStirlingOrigin(baseUrl);
  const keystore = keystorePath ? await readFile(keystorePath) :
    decodeBase64(keystoreBase64, "STIRLING_KEYSTORE_INVALID");
  if (keystore.length < 100 || keystore.length > MAX_KEYSTORE_BYTES) {
    throw new Error("STIRLING_KEYSTORE_INVALID");
  }
  const signerPem = decodeBase64(certBase64, "STIRLING_SIGNER_CERT_INVALID").toString("utf8");
  let certificate: X509Certificate;
  try { certificate = new X509Certificate(signerPem); }
  catch { throw new Error("STIRLING_SIGNER_CERT_INVALID"); }
  const now = Date.now();
  if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) < now) {
    throw new Error("STIRLING_SIGNER_CERT_EXPIRED");
  }
  const trustAnchorPem = process.env.STIRLING_TRUST_ANCHOR_PEM_BASE64
    ? decodeBase64(process.env.STIRLING_TRUST_ANCHOR_PEM_BASE64,
      "STIRLING_TRUST_ANCHOR_INVALID").toString("utf8")
    : undefined;
  if (trustAnchorPem) {
    try { new X509Certificate(trustAnchorPem); }
    catch { throw new Error("STIRLING_TRUST_ANCHOR_INVALID"); }
  }
  const revocationMode = process.env.STIRLING_REVOCATION_POLICY ?? "strict";
  if (!["strict", "allow-unchecked"].includes(revocationMode)) {
    throw new Error("STIRLING_REVOCATION_POLICY_INVALID");
  }
  if (process.env.NODE_ENV === "production" && revocationMode !== "strict") {
    throw new Error("STIRLING_REVOCATION_POLICY_UNSAFE");
  }
  const apiKey = process.env.STIRLING_API_KEY?.trim();
  if (process.env.NODE_ENV === "production" && origin.startsWith("https:") && !apiKey) {
    throw new Error("STIRLING_REMOTE_AUTH_REQUIRED");
  }
  if (apiKey && (apiKey.length < 12 || apiKey.includes("\n"))) {
    throw new Error("STIRLING_API_KEY_INVALID");
  }
  return {
    baseUrl: origin, apiKey, tenantId, issuerLegalName,
    p12: keystore, password,
    expectedCertSerial: normalizeSerial(certificate.serialNumber),
    trustAnchorPem,
    requireRevocation: revocationMode === "strict",
  };
}

export function normalizeSerial(value: string): string {
  return value.replace(/^0+/, "").replace(/:/g, "").toLowerCase() || "0";
}

export function assertTrustedStirlingSignature(
  raw: unknown,
  config: Pick<StirlingConfig, "expectedCertSerial" | "requireRevocation">,
): StirlingValidation {
  if (!Array.isArray(raw) || raw.length !== 1) {
    throw new Error("STIRLING_SIGNATURE_COUNT_INVALID");
  }
  const validation = raw[0] as Partial<StirlingValidation> | null;
  if (!validation || typeof validation !== "object" ||
      validation.valid !== true ||
      validation.coversEntireDocument !== true ||
      validation.chainValid !== true ||
      validation.trustValid !== true ||
      validation.notExpired !== true ||
      validation.selfSigned !== false ||
      typeof validation.serialNumber !== "string" ||
      normalizeSerial(validation.serialNumber) !== normalizeSerial(config.expectedCertSerial) ||
      typeof validation.subjectDN !== "string" || !validation.subjectDN ||
      typeof validation.issuerDN !== "string" || !validation.issuerDN) {
    throw new Error("STIRLING_SIGNATURE_VALIDATION_FAILED");
  }
  if (validation.revocationStatus === "revoked" ||
      validation.revocationStatus === "soft-fail") {
    throw new Error("STIRLING_CERT_REVOCATION_INVALID");
  }
  if (config.requireRevocation &&
      (validation.revocationChecked !== true || validation.revocationStatus !== "good")) {
    throw new Error("STIRLING_REVOCATION_NOT_VERIFIED");
  }
  return validation as StirlingValidation;
}

async function limitedBody(response: Response, max: number): Promise<Buffer> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > max) throw new Error("STIRLING_RESPONSE_TOO_LARGE");
  if (!response.body) throw new Error("STIRLING_RESPONSE_EMPTY");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error("STIRLING_RESPONSE_TOO_LARGE");
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, size);
}

async function endpoint(
  path: "/api/v1/security/cert-sign" | "/api/v1/security/validate-signature",
  data: FormData,
  config: StirlingConfig,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(config.baseUrl + path, {
      method: "POST", body: data,
      headers: { ...(config.apiKey ? { "X-API-KEY": config.apiKey } : {}) },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25000),
    });
  } catch { throw new Error("STIRLING_UNREACHABLE"); }
  if (!response.ok) {
    // Provider error responses may contain secrets; never echo them to callers.
    throw new Error("STIRLING_REQUEST_FAILED");
  }
  return response;
}

export async function signCertificateWithStirling(
  certificate: AcademicCertificate,
  original: Uint8Array,
  config?: StirlingConfig,
): Promise<InstitutionalSignature> {
  const settings = config ?? await loadStirlingConfig(certificate.tenantId);
  if (settings.tenantId !== certificate.tenantId ||
      settings.issuerLegalName.toLocaleLowerCase().trim() !==
        certificate.issuerLegalName.toLocaleLowerCase().trim() ||
      certificate.provider !== "stirling" || certificate.status !== "preparing") {
    throw new Error("STIRLING_SIGNING_NOT_AUTHORIZED");
  }
  if (original.length < 100 || original.length > MAX_PDF_BYTES ||
      Buffer.from(original).subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("STIRLING_INPUT_PDF_INVALID");
  }
  const data = new FormData();
  data.append("fileInput", new Blob([new Uint8Array(original)], { type: "application/pdf" }),
    "luma-certificate.pdf");
  data.append("certType", "PKCS12");
  data.append("p12File", new Blob([new Uint8Array(settings.p12)],
    { type: "application/x-pkcs12" }), "institution.p12");
  data.append("password", settings.password);
  data.append("name", certificate.issuerLegalName);
  data.append("reason", "Emision de credencial academica autorizada en LUMA");
  data.append("showSignature", "false");
  data.append("showLogo", "false");

  const signResponse = await endpoint("/api/v1/security/cert-sign", data, settings);
  const signedPdf = await limitedBody(signResponse, MAX_PDF_BYTES);
  if (signedPdf.length < 100 || signedPdf.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("STIRLING_SIGNED_PDF_INVALID");
  }
  // Compare reserved academic document identity, not only response MIME type.
  let signedDocument: PDFDocument;
  try { signedDocument = await PDFDocument.load(signedPdf); }
  catch { throw new Error("STIRLING_SIGNED_PDF_INVALID"); }
  if (signedDocument.getSubject() !== "LUMA_CERTIFICATE:" + certificate.certificateId ||
      signedDocument.getPageCount() !== 1 ||
      signedDocument.getTitle() !== "Certificado - " + certificate.programTitle) {
    throw new Error("STIRLING_DOCUMENT_IDENTITY_MISMATCH");
  }

  const verifyData = new FormData();
  verifyData.append("fileInput", new Blob([new Uint8Array(signedPdf)],
    { type: "application/pdf" }), "signed.pdf");
  if (settings.trustAnchorPem) {
    verifyData.append("certFile", new Blob([settings.trustAnchorPem],
      { type: "application/x-pem-file" }), "trust-anchor.pem");
  }
  const response = await endpoint("/api/v1/security/validate-signature", verifyData, settings);
  let parsed: unknown;
  try { parsed = JSON.parse((await limitedBody(response, MAX_VALIDATION_BYTES)).toString("utf8")); }
  catch { throw new Error("STIRLING_VALIDATION_RESPONSE_INVALID"); }
  const verified = assertTrustedStirlingSignature(parsed, settings);
  const signedAt = new Date().toISOString();
  const signedSha256 = createHash("sha256").update(signedPdf).digest("hex");
  return {
    signedPdf, signedSha256, signedAt,
    evidence: {
      schemaVersion: 1, provider: "stirling", certificateId: certificate.certificateId,
      tenantId: certificate.tenantId, signedSha256,
      unsignedSha256: createHash("sha256").update(original).digest("hex"),
      signedAt,
      signerCertificateSerial: normalizeSerial(verified.serialNumber),
      signerSubjectDN: verified.subjectDN,
      signerIssuerDN: verified.issuerDN,
      cryptographicSignatureValid: true,
      certificateChainTrusted: true,
      coversEntireDocument: true,
      revocationChecked: verified.revocationChecked,
      revocationStatus: verified.revocationStatus,
      verificationPerformedAt: signedAt,
    },
  };
}
