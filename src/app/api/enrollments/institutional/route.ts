import { NextResponse } from "next/server";
import { requireLearningAdmin } from "@/lib/learning-server";
import { institutionalGrants } from "@/lib/commerce/institutional-grant-server";
import { authorizeInstitutionalAdmin, parseInstitutionalGrant } from "@/lib/commerce/institutional-grants";
import { institutionalGrantError } from "@/lib/commerce/institutional-grant-http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const admin = await requireLearningAdmin(request);
    const grant = parseInstitutionalGrant(await request.json());
    authorizeInstitutionalAdmin(admin as Record<string, unknown>, grant.tenantId);
    const result = await institutionalGrants.grant(grant, admin.uid);
    return NextResponse.json({
      enrollment: {
        enrollmentId: result.record.enrollmentId,
        status: result.record.status,
        tenantId: result.record.tenantId,
        programId: result.record.programId,
        offeringId: result.record.offeringId,
        accessEndsAt: result.record.accessEndsAt,
      },
      action: result.action, duplicate: result.duplicate,
    }, { status: result.duplicate ? 200 : 201, headers: { "cache-control": "no-store" } });
  } catch (error) { return institutionalGrantError(error); }
}

export async function GET(request: Request) {
  try {
    const admin = await requireLearningAdmin(request);
    const params = new URL(request.url).searchParams;
    const tenantId = params.get("tenantId")?.trim() ?? "";
    authorizeInstitutionalAdmin(admin as Record<string, unknown>, tenantId);
    const limit = params.has("limit") ? Number(params.get("limit")) : 50;
    const cursor = params.get("cursor") || undefined;
    const page = await institutionalGrants.listPage(tenantId, limit, cursor);
    return NextResponse.json(page, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return institutionalGrantError(error); }
}
