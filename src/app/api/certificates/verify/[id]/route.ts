import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { certificates } from "@/lib/certificates/server";
import { documentId, publicCertificateState } from "@/lib/certificates/domain";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const certificate = await certificates.get(documentId(id, "certificate_id"));
    const verification = certificate && publicCertificateState(certificate);
    if (!verification) return NextResponse.json({ error: "certificate_not_found" }, {
      status: 404, headers: { "cache-control": "no-store" },
    });
    return NextResponse.json({ verification }, {
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    });
  } catch (error) { return certificateError(error); }
}
