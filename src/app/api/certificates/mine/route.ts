import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { requireLearningUser } from "@/lib/learning-server";
import { certificates } from "@/lib/certificates/server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const data = await certificates.mine(user.uid);
    return NextResponse.json({
      certificates: data.map(certificate => ({
        certificateId: certificate.certificateId,
        programTitle: certificate.programTitle,
        issuerLegalName: certificate.issuerLegalName,
        status: certificate.status, issuedAt: certificate.issuedAt,
        signedAt: certificate.signedAt ?? null,
      })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return certificateError(error); }
}
