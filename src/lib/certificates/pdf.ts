import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { AcademicCertificate } from "./domain";

function wrap(
  text: string, font: { widthOfTextAtSize: (s: string, n: number) => number },
  size: number, width: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function certificateBaseUrl(): string {
  const raw = process.env.LUMA_PUBLIC_BASE_URL;
  if (!raw) throw new Error("CERTIFICATE_PUBLIC_URL_NOT_CONFIGURED");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("CERTIFICATE_PUBLIC_URL_INVALID"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search ||
      url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("CERTIFICATE_PUBLIC_URL_INVALID");
  }
  return url.origin;
}

export async function renderCertificatePdf(
  record: AcademicCertificate,
  origin = certificateBaseUrl(),
): Promise<Uint8Array> {
  const url = `${origin}/verify/${encodeURIComponent(record.certificateId)}`;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const [regular, bold, serif] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedFont(StandardFonts.TimesRoman),
  ]);
  const ink = rgb(0.14, 0.18, 0.21);
  const accent = rgb(0.38, 0.18, 0.28);
  const muted = rgb(0.40, 0.45, 0.48);
  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(0.99, 0.985, 0.974) });
  page.drawRectangle({ x: 26, y: 26, width: 790, height: 543, borderColor: accent, borderWidth: 1.2 });
  page.drawRectangle({ x: 34, y: 524, width: 774, height: 33, color: accent });
  page.drawText("L U M A   |   C R E D E N C I A L   A C A D E M I C A", {
    x: 66, y: 535, font: bold, size: 10, color: rgb(1, 1, 1),
  });
  page.drawText("CERTIFICADO DE FINALIZACIÓN", {
    x: 66, y: 464, font: bold, size: 25, color: accent,
  });
  page.drawText("La institución que suscribe certifica que", {
    x: 66, y: 418, font: regular, size: 13, color: muted,
  });

  const nameLines = wrap(record.learnerName, serif, 31, 660);
  if (nameLines.length > 2) throw new Error("CERTIFICATE_NAME_TOO_LONG_FOR_TEMPLATE");
  nameLines.forEach((line, index) =>
    page.drawText(line, { x: 66, y: 373 - index * 36, font: serif, size: 31, color: ink }));
  const programY = 309 - (nameLines.length - 1) * 32;
  page.drawText("ha completado satisfactoriamente el programa", {
    x: 66, y: programY, font: regular, size: 12, color: muted,
  });
  const titleLines = wrap(record.programTitle, bold, 18, 690);
  if (titleLines.length > 2) throw new Error("CERTIFICATE_PROGRAM_TOO_LONG_FOR_TEMPLATE");
  titleLines.forEach((line, index) =>
    page.drawText(line, { x: 66, y: programY - 35 - index * 22, font: bold, size: 18, color: ink }));
  page.drawText(`Expedido por: ${record.issuerLegalName}`, {
    x: 66, y: 199, font: regular, size: 10, color: muted,
  });
  page.drawText(`Fecha de emisión: ${record.issuedAt.slice(0, 10)}`, {
    x: 66, y: 180, font: regular, size: 10, color: muted,
  });

  const pngDataUrl = await QRCode.toDataURL(url, {
    width: 154, margin: 1, errorCorrectionLevel: "M",
  });
  const embeddedQr = await pdf.embedPng(Buffer.from(pngDataUrl.split(",")[1], "base64"));
  page.drawImage(embeddedQr, { x: 68, y: 58, width: 108, height: 108 });
  page.drawText("Verifica autenticidad", { x: 184, y: 130, font: bold, size: 10, color: ink });
  page.drawText(`Código: ${record.certificateId}`, {
    x: 184, y: 112, font: regular, size: 8, color: muted,
  });
  page.drawText(url, { x: 184, y: 94, font: regular, size: 8, color: accent });

  page.drawLine({ start: { x: 570, y: 140 }, end: { x: 755, y: 140 },
    thickness: 0.7, color: accent });
  page.drawText(record.signerName, { x: 570, y: 118, font: bold, size: 10, color: ink });
  page.drawText("Firma electrónica del emisor", {
    x: 570, y: 101, font: regular, size: 9, color: muted,
  });
  page.drawText("La validez depende de la firma completada y de su estado de verificación en LUMA.", {
    x: 66, y: 42, font: regular, size: 8, color: muted,
  });
  pdf.setTitle(`Certificado - ${record.programTitle}`);
  pdf.setAuthor(record.issuerLegalName);
  pdf.setSubject("Credencial académica pendiente de firma electrónica");
  pdf.setKeywords(["LUMA", "certificado", "verificación"]);
  return pdf.save({ useObjectStreams: false });
}
