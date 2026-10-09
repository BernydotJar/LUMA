import { NextResponse } from "next/server";
import { requireLearningUser, requireLearningCoachAccess } from "@/lib/learning-server";
import { certificates } from "@/lib/certificates/server";
import { certificateError } from "@/lib/certificates/http";
import { documentId } from "@/lib/certificates/domain";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const certificate = await certificates.get(documentId(id, "certificate_id"));
    if (!certificate) return NextResponse.json({ error: "certificate_not_found" },
      { status: 404, headers: { "cache-control": "no-store" } });
    const user = await requireLearningUser(request);
    if (certificate.learnerId !== user.uid) {
      const { decoded, access } = await requireLearningCoachAccess(request);
      const offering = await certificates.authorizedOffering(
        { uid: decoded.uid, access }, certificate.offeringId, certificate.learnerId);
      if (offering.tenantId !== certificate.tenantId ||
          offering.programId !== certificate.programId) {
        return NextResponse.json({ error: "not_authorized" }, { status: 403 });
      }
    }
    return NextResponse.json({ certificate: {
      certificateId: certificate.certificateId,
      status: certificate.status,
      programTitle: certificate.programTitle,
      issuedAt: certificate.issuedAt,
      signedAt: certificate.signedAt ?? null,
      revokedAt: certificate.revokedAt ?? null,
      verificationUrl: certificate.status === "signed" || certificate.status === "revoked"
        ? `/verify/${encodeURIComponent(certificate.certificateId)}` : null,
    } }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return certificateError(error); }
}
