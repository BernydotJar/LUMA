import { NextResponse } from "next/server";
import { requireLearningAdmin } from "@/lib/learning-server";
import { institutionalGrants } from "@/lib/commerce/institutional-grant-server";
import { authorizeInstitutionalAdmin } from "@/lib/commerce/institutional-grants";
import { institutionalGrantError } from "@/lib/commerce/institutional-grant-http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireLearningAdmin(request);
    const body = (await request.json()) as { tenantId?: unknown; reason?: unknown };
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    authorizeInstitutionalAdmin(admin as Record<string, unknown>, tenantId);
    const { id } = await context.params;
    const result = await institutionalGrants.revoke(tenantId, id, admin.uid, body.reason);
    return NextResponse.json({
      enrollmentId: result.record.enrollmentId,
      status: result.record.status,
      duplicate: result.duplicate,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return institutionalGrantError(error); }
}
