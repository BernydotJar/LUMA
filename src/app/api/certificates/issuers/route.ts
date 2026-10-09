import { NextResponse } from "next/server";
import { certificateError } from "@/lib/certificates/http";
import { requireLearningAdmin } from "@/lib/learning-server";
import { certificates } from "@/lib/certificates/server";
import { documentId } from "@/lib/certificates/domain";
import { assertTenantAdmin } from "@/lib/tenant-admin-access";

export const runtime = "nodejs";
export async function PUT(request: Request) {
  try {
    const admin = await requireLearningAdmin(request);
    const payload = await request.json() as { tenantId?: unknown; legalName?: unknown; signerName?: unknown; signerEmail?: unknown; institutionalSigningAuthorized?: unknown };
    assertTenantAdmin(admin as Record<string, unknown>, documentId(payload.tenantId, "tenant_id"));
    const settings = await certificates.configureIssuer(payload, admin.uid);
    return NextResponse.json({
      issuer: {
        tenantId: settings.tenantId, legalName: settings.legalName,
        signerName: settings.signerName, signerEmail: settings.signerEmail,
        institutionalSigningAuthorized: Boolean(settings.institutionalSigningAuthorizedAt),
        updatedAt: settings.updatedAt,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return certificateError(error); }
}
