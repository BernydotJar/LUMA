import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { requireLearningAdmin } from "@/lib/learning-server";
import { certificates } from "@/lib/certificates/server";

export const runtime = "nodejs";
export async function PUT(request: Request) {
  try {
    const admin = await requireLearningAdmin(request);
    const settings = await certificates.configureIssuer(await request.json(), admin.uid);
    return NextResponse.json({
      issuer: {
        tenantId: settings.tenantId, legalName: settings.legalName,
        signerName: settings.signerName, signerEmail: settings.signerEmail,
        updatedAt: settings.updatedAt,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return certificateError(error); }
}
