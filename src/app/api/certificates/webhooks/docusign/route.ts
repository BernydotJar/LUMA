import { NextResponse } from "next/server";
import { certificates } from "@/lib/certificates/server";
import { parseCompletedEnvelopeEvent, verifyDocusignConnectHmac } from "@/lib/certificates/docusign";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > 65536) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 65536) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  if (!verifyDocusignConnectHmac(
    rawBody, request.headers.get("x-docusign-signature-1"),
  )) return NextResponse.json({ error: "invalid_webhook_signature" }, { status: 401 });
  let event: unknown;
  try { event = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "invalid_payload" }, { status: 400 }); }
  const envelopeId = parseCompletedEnvelopeEvent(event);
  if (!envelopeId) return NextResponse.json({ accepted: true, ignored: true });
  try {
    const result = await certificates.finalizeEnvelope(envelopeId);
    return NextResponse.json({
      accepted: true, certificateId: result.certificateId, status: result.status,
    });
  } catch {
    return NextResponse.json({ error: "certificate_reconciliation_pending" },
      { status: 503, headers: { "retry-after": "300" } });
  }
}
