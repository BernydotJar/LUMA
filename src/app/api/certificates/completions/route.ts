import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { requireLearningCoachAccess } from "@/lib/learning-server";
import { certificates } from "@/lib/certificates/server";
import { documentId } from "@/lib/certificates/domain";
import { assertCertificateTenantAccess } from "@/lib/certificates/authorization";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { decoded, access } = await requireLearningCoachAccess(request);
    const body = await request.json() as { offeringId: unknown };
    const offering = await certificates.offering(documentId(body.offeringId, "offering_id"));
    assertCertificateTenantAccess(decoded as Record<string, unknown>, offering.tenantId);
    const completion = await certificates.approveCompletion(
      { uid: decoded.uid, access }, body,
    );
    return NextResponse.json({ completion }, {
      status: 200, headers: { "cache-control": "no-store" },
    });
  } catch (error) { return certificateError(error); }
}
