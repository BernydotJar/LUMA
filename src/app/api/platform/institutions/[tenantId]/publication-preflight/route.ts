import { NextResponse } from "next/server";
import { requireLearningAdmin } from "@/lib/learning-server";
import { isPlatformSuperuser } from "@/lib/tenant-admin-access";
import { parseDraftTenantId } from "@/lib/institutions/draft-input";
import { institutionPublicationInspector } from "@/lib/institutions/publication-preflight-server";

export const runtime = "nodejs";
type Context = { params: Promise<{ tenantId: string }> };
const cacheHeader = { "cache-control": "private, no-store" };
const reply = (value: object, status: number) => NextResponse.json(value, {
  status, headers: cacheHeader,
});

/** No POST/PATCH: a preflight can never become an accidental publish endpoint. */
export async function GET(request: Request, context: Context) {
  if (process.env.LUMA_INSTITUTION_PREFLIGHT_ENABLED !== "true") {
    return reply({ error: "feature_unavailable" }, 503);
  }
  try {
    // Includes checkRevoked=true. A scoped admin/coach/learner is not enough.
    const admin = await requireLearningAdmin(request);
    if (!isPlatformSuperuser(admin as Record<string, unknown>)) {
      return reply({ error: "not_authorized" }, 403);
    }
    const tenantId = parseDraftTenantId((await context.params).tenantId);
    const preflight = await institutionPublicationInspector.inspect(tenantId);
    return reply({ preflight }, 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const firebaseCode = error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code : undefined;
    if (code === "AUTH_REQUIRED" ||
        (typeof firebaseCode === "string" && firebaseCode.startsWith("auth/"))) {
      return reply({ error: "authentication_required" }, 401);
    }
    if (code === "ADMIN_REQUIRED") return reply({ error: "not_authorized" }, 403);
    if (code === "INSTITUTION_PREFLIGHT_DRAFT_NOT_FOUND") {
      return reply({ error: "draft_not_found" }, 404);
    }
    if (code === "INSTITUTION_DRAFT_TENANT_INVALID") {
      return reply({ error: "invalid_tenant" }, 400);
    }
    // Corrupt data, Firestore index errors and IAM outages are not input errors.
    return reply({ error: "preflight_unavailable" }, 503);
  }
}
