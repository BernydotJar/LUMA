import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { requireLearningUser } from "@/lib/learning-server";
import { documentId } from "@/lib/certificates/domain";
import { certificates } from "@/lib/certificates/server";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireLearningUser(request);
    const { id } = await context.params;
    const certificateId = documentId(id, "certificate_id");
    const bytes = await certificates.pdfForLearner(certificateId, user.uid);
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=\"certificado-luma.pdf\"",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) { return certificateError(error); }
}
