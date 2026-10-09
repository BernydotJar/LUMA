import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningAdmin } from "@/lib/learning-server";
import { parseCommerceAccessTraceQuery, readCommerceAccessTrace } from "@/lib/commerce/trace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // This is intentionally global-admin-only, not a tenant-scoped capability.
    await requireLearningAdmin(request);
    const { tenantId, entitlementId } = parseCommerceAccessTraceQuery(request.url);
    const trace = await readCommerceAccessTrace(firebaseAdminFirestore, tenantId, entitlementId);
    if (!trace) return NextResponse.json({ error: "trace_not_found" }, { status: 404 });
    return NextResponse.json(trace, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (message === "ADMIN_REQUIRED") {
      return NextResponse.json({ error: "admin_role_required" }, { status: 403 });
    }
    if (message.startsWith("INVALID_TRACE")) {
      return NextResponse.json({ error: "invalid_trace_query" }, { status: 400 });
    }
    return NextResponse.json({ error: "commerce_trace_unavailable" }, { status: 500 });
  }
}
