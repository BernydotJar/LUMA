import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { requireLearningAdmin } from "@/lib/learning-server";
import { documentId } from "@/lib/certificates/domain";
import { certificates } from "@/lib/certificates/server";
import { assertTenantAdmin } from "@/lib/tenant-admin-access";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireLearningAdmin(request);
    const { id } = await context.params;
    const certificate = await certificates.get(documentId(id, "certificate_id"));
    if (!certificate) throw new Error("CERTIFICATE_NOT_FOUND");
    assertTenantAdmin(admin as Record<string, unknown>, certificate.tenantId);
    const body = await request.json() as { reason?: unknown };
    const result = await certificates.revoke(
      documentId(id, "certificate_id"), admin.uid, body.reason,
    );
    return NextResponse.json({ certificateId: result.certificateId, status: result.status },
      { headers: { "cache-control": "no-store" } });
  } catch (error) { return certificateError(error); }
}
