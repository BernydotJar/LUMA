import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import type { AcademicCertificate } from "./domain";
import { renderCertificatePdf } from "./pdf";
import {
  assertTrustedStirlingSignature, normalizeSerial, signCertificateWithStirling,
  validateStirlingOrigin, type StirlingConfig, type StirlingValidation,
} from "./stirling";

const cert: AcademicCertificate = {
  certificateId: "e168b0dc-8fdc-4a5a-901a-32100532aa9d",
  completionId: "approved", tenantId: "seres", offeringId: "cohort-a",
  programId: "leadership", learnerId: "learner-secret",
  learnerName: "María Fernanda Gómez", programTitle: "Transformación de Liderazgo",
  issuerLegalName: "Seres de Excelencia",
  signerName: "Dirección Académica", signerEmail: "emisor@example.com",
  provider: "stirling", status: "preparing",
  issuedAt: "2026-10-09T20:00:00Z", updatedAt: "2026-10-09T20:00:00Z",
  issuedBy: "authorized-coach",
};
const config: StirlingConfig = {
  baseUrl: "http://stirling-pdf:8080",
  tenantId: "seres",
  issuerLegalName: "Seres de Excelencia",
  p12: Buffer.alloc(200, 14),
  password: "testing-keystore-password",
  apiKey: "testing-private-api-key",
  expectedCertSerial: "00ABCD",
  requireRevocation: true,
};
const accepted: StirlingValidation = {
  valid: true, chainValid: true, trustValid: true,
  notExpired: true, coversEntireDocument: true,
  revocationChecked: true, revocationStatus: "good",
  serialNumber: "ABCD", subjectDN: "CN=Seres de Excelencia",
  issuerDN: "CN=Authorized Root", selfSigned: false,
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("Stirling signing: API contract, authorization, fail closed", () => {
  it("rejects dynamic/private-network URL misuse and basic invalid configuration", () => {
    expect(validateStirlingOrigin("http://stirling-pdf:8080")).toBe("http://stirling-pdf:8080");
    expect(validateStirlingOrigin("https://signing.example.org")).toBe("https://signing.example.org");
    for (const bad of [
      "http://example.org", "http://10.0.0.2:8080", "file:///etc/passwd",
      "https://user:pass@sign.example.org", "http://localhost:8080/evil",
      "https://sign.example.org/?redirect=https://evil.org",
    ]) expect(() => validateStirlingOrigin(bad)).toThrow("STIRLING_URL_INVALID");
  });
  it("validates signatures, signer identity and trusted chain strictly", () => {
    expect(normalizeSerial("00:A0:FF")).toBe("a0ff");
    expect(assertTrustedStirlingSignature([accepted], config)).toBe(accepted);
    expect(() => assertTrustedStirlingSignature([], config)).toThrow("STIRLING_SIGNATURE_COUNT_INVALID");
    for (const patch of [
      { valid: false }, { chainValid: false }, { trustValid: false },
      { notExpired: false }, { coversEntireDocument: false },
      { selfSigned: true }, { serialNumber: "BAD" },
      { subjectDN: "" }, { issuerDN: "" },
    ]) expect(() => assertTrustedStirlingSignature([{ ...accepted, ...patch }], config))
      .toThrow("STIRLING_SIGNATURE_VALIDATION_FAILED");
    for (const value of ["revoked", "soft-fail"]) {
      expect(() => assertTrustedStirlingSignature([{
        ...accepted, revocationStatus: value,
      }], config)).toThrow("STIRLING_CERT_REVOCATION_INVALID");
    }
    expect(() => assertTrustedStirlingSignature([{
      ...accepted, revocationChecked: false, revocationStatus: "not-checked",
    }], config)).toThrow("STIRLING_REVOCATION_NOT_VERIFIED");
  });
  it("posts exact PKCS12 form-data, independently validates and returns immutable evidence", async () => {
    const original = await renderCertificatePdf(cert, "https://luma.example.org");
    const calls: Array<{ url: string; data: FormData; header: string | undefined }> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const data = init.body as FormData;
      calls.push({ url, data, header: (init.headers as Record<string, string>)["X-API-KEY"] });
      if (url.endsWith("/cert-sign")) {
        return new Response(new Uint8Array(original), {
          headers: { "content-type": "application/pdf" },
        });
      }
      return Response.json([accepted]);
    }));
    const result = await signCertificateWithStirling(cert, original, config);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe("http://stirling-pdf:8080/api/v1/security/cert-sign");
    expect(calls[1].url).toBe("http://stirling-pdf:8080/api/v1/security/validate-signature");
    expect(calls[0].header).toBe(config.apiKey);
    expect(calls[0].data.get("certType")).toBe("PKCS12");
    expect(calls[0].data.get("password")).toBe(config.password);
    expect(calls[0].data.get("showSignature")).toBe("false");
    expect(calls[0].data.get("name")).toBe("Seres de Excelencia");
    expect((calls[0].data.get("p12File") as File).size).toBe(config.p12.length);
    expect((calls[0].data.get("fileInput") as File).size).toBe(original.length);
    expect((calls[1].data.get("fileInput") as File).size).toBe(original.length);
    const signedDocument = await PDFDocument.load(result.signedPdf);
    expect(signedDocument.getSubject()).toBe("LUMA_CERTIFICATE:" + cert.certificateId);
    expect(result.evidence).toMatchObject({
      provider: "stirling", tenantId: "seres", signerCertificateSerial: "abcd",
      certificateChainTrusted: true, coversEntireDocument: true, revocationStatus: "good",
    });
    expect(result.evidence.signedSha256).toBe(result.signedSha256);
    expect(JSON.stringify(result.evidence)).not.toContain(config.password);
    expect(JSON.stringify(result.evidence)).not.toContain("learner-secret");
  });
  it("rejects fake provider successes, unsigned validation and cross-tenant signing", async () => {
    const original = await renderCertificatePdf(cert, "https://luma.example.org");
    await expect(signCertificateWithStirling({
      ...cert, tenantId: "another-tenant",
    }, original, config)).rejects.toThrow("STIRLING_SIGNING_NOT_AUTHORIZED");
    await expect(signCertificateWithStirling({
      ...cert, issuerLegalName: "Fraudulent Institution",
    }, original, config)).rejects.toThrow("STIRLING_SIGNING_NOT_AUTHORIZED");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "fake" })));
    await expect(signCertificateWithStirling(cert, original, config))
      .rejects.toThrow("STIRLING_SIGNED_PDF_INVALID");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/cert-sign")
      ? new Response(new Uint8Array(original))
      : Response.json([])));
    await expect(signCertificateWithStirling(cert, original, config))
      .rejects.toThrow("STIRLING_SIGNATURE_COUNT_INVALID");
  });
  it("detects substituting another academic PDF even if service returned HTTP 200", async () => {
    const original = await renderCertificatePdf(cert, "https://luma.example.org");
    const impostor = await renderCertificatePdf({
      ...cert, certificateId: "a-real-but-different-certificate",
    }, "https://luma.example.org");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(impostor))));
    await expect(signCertificateWithStirling(cert, original, config))
      .rejects.toThrow("STIRLING_DOCUMENT_IDENTITY_MISMATCH");
  });
  it("does not follow redirects or leak upstream error response bodies", async () => {
    const original = await renderCertificatePdf(cert, "https://luma.example.org");
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("keystore-sensitive-exception", { status: 500 })));
    await expect(signCertificateWithStirling(cert, original, config))
      .rejects.toThrow("STIRLING_REQUEST_FAILED");
  });
});
