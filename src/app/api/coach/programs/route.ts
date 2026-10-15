import { NextResponse } from "next/server";
import { requireLearningCoachAccess } from "@/lib/learning-server";
import { resolveLearningAccessPolicy } from "@/lib/learning-entitlement";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { authorizedCoachPrograms, readTenantCoachOfferings } from "@/lib/coach-program-authority";

export const runtime = "nodejs";
const headers = { "cache-control": "private, no-store" };

/**
 * Lists active course choices for a coach in the configured deployment tenant.
 * Enrollment evidence still requires a separate program-scoped authorization.
 */
export async function GET(request: Request) {
  try {
    const { decoded, access } = await requireLearningCoachAccess(request);
    const policy = resolveLearningAccessPolicy(process.env);
    if (policy.mode === "showcase") {
      return NextResponse.json({ mode: "showcase", courses: [] }, { headers });
    }
    if (!access.unrestricted && !access.tenantIds.includes(policy.tenantId)) {
      return NextResponse.json({ error: "coach_scope_required" }, { status: 403, headers });
    }
    // Discovery and actual evidence reads use the SAME authoritative program
    // grant policy, including the current program-wide cohort limitation.
    const offerings = await readTenantCoachOfferings(policy.tenantId);
    const choices = authorizedCoachPrograms(access, decoded.uid, policy.tenantId, offerings);
    const courses = choices.map((program) => {
      const offering = program.offerings.filter((item) => item.status === "active")
        .sort((a, b) => a.title.localeCompare(b.title))[0];
      return {
        tenantId: program.tenantId,
        programId: program.programId,
        title: offering.title,
        offeringId: offering.offeringId,
        deliveryMode: offering.deliveryMode,
      };
    }).sort((a, b) => a.title.localeCompare(b.title));

    return NextResponse.json({ mode: "entitled", courses }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401, headers });
    }
    if (message === "COACH_REQUIRED" || message === "COACH_SCOPE_REQUIRED") {
      return NextResponse.json({ error: "coach_scope_required" }, { status: 403, headers });
    }
    if (message === "COACH_PROGRAM_CATALOG_TOO_LARGE") {
      return NextResponse.json({ error: "coach_program_catalog_too_large" }, { status: 409, headers });
    }
    if (message === "LEARNING_ACCESS_MODE_INVALID" || message === "LEARNING_ACCESS_TENANT_REQUIRED") {
      return NextResponse.json({ error: "learning_access_not_configured" }, { status: 503, headers });
    }
    return NextResponse.json({ error: "coach_programs_unavailable" }, { status: 503, headers });
  }
}
