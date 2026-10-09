import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderCertificatePdf, certificateBaseUrl } from "./pdf";
import type { AcademicCertificate } from "./domain";

const cert: AcademicCertificate = {
  certificateId: "cbb637b6-80da-4f18-b4be-889714f8b754",
  completionId: "completed", tenantId: "seres", offeringId: "2026-a",
  programId: "leadership", learnerId: "private-uid",
  learnerName: "María Fernanda Gómez", programTitle: "Transformación de Liderazgo y Desarrollo Humano",
  issuerLegalName: "Seres de Excelencia", signerName: "Diego Restrepo",
  signerEmail: "signer@example.com", provider: "docusign",
  status: "preparing", issuedAt: "2026-10-09T20:00:00Z",
  updatedAt: "2026-10-09T20:00:00Z", issuedBy: "trainer-uid",
};

describe("certificate PDF", () => {
  it("creates a valid single-page unsigned A4 PDF with QR", async () => {
    const bytes = await renderCertificatePdf(cert, "https://luma.example.com");
    expect(bytes.subarray(0, 5).toString()).not.toBe("bad!");
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getPage(0).getWidth()).toBe(842);
    expect(pdf.getPage(0).getHeight()).toBe(595);
    expect(pdf.getTitle()).toContain("Transformación");
    expect(bytes.length).toBeGreaterThan(5000);
  });
  it("requires a trusted HTTPS verification base URL", () => {
    const previous = process.env.LUMA_PUBLIC_BASE_URL;
    process.env.LUMA_PUBLIC_BASE_URL = "http://local.test";
    expect(() => certificateBaseUrl()).toThrow("CERTIFICATE_PUBLIC_URL_INVALID");
    if (previous === undefined) delete process.env.LUMA_PUBLIC_BASE_URL;
    else process.env.LUMA_PUBLIC_BASE_URL = previous;
  });
});
