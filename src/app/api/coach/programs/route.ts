import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { requireLearningCoachAccess } from "@/lib/learning-server";
import { resolveLearningAccessPolicy } from "@/lib/learning-entitlement";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { isInstitutionalAdmin, isPlatformSuperuser } from "@/lib/tenant-admin-access";
import type { ProgramOffering } from "@/lib/program-delivery";

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
    const unrestricted = isPlatformSuperuser(decoded as Record<string, unknown>);
    const admin = isInstitutionalAdmin(decoded as Record<string, unknown>);
    const allowedTenant = unrestricted || access.tenantIds.includes(policy.tenantId);
    if (!allowedTenant && !access.learnerIds.length) {
      return NextResponse.json({ error: "coach_scope_required" }, { status: 403, headers });
    }

    // Bounded list, not an organization-wide catalog. A coach without explicit
    // offering assignment never sees unrelated program titles.
    const result = await firebaseAdminFirestore.collection("programOfferings")
      .where("tenantId", "==", policy.tenantId)
      .limit(101).get();
    if (result.size > 100) {
      return NextResponse.json({ error: "coach_program_catalog_too_large" }, { status: 409, headers });
    }
    const permitted = result.docs.map((doc) => doc.data() as ProgramOffering)
      .filter((offering) =>
        offering.status === "active" && offering.tenantId === policy.tenantId &&
        (unrestricted || (admin && allowedTenant) || offering.coachIds.includes(decoded.uid)))
      .sort((a, b) => a.title.localeCompare(b.title));
    // Coach evidence is program-scoped, not cohort-scoped: one option per
    // program prevents duplicate keys or falsely suggesting cohort isolation.
    const byProgram = new Map<string, ProgramOffering>();
    for (const offering of permitted) {
      if (!byProgram.has(offering.programId)) byProgram.set(offering.programId, offering);
    }
    const courses = [...byProgram.values()].map((offering) => ({
      tenantId: offering.tenantId,
      programId: offering.programId,
      title: offering.title,
      offeringId: offering.offeringId,
      deliveryMode: offering.deliveryMode,
    }));

    return NextResponse.json({ mode: "entitled", courses }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401, headers });
    }
    if (message === "COACH_REQUIRED" || message === "COACH_SCOPE_REQUIRED") {
      return NextResponse.json({ error: "coach_scope_required" }, { status: 403, headers });
    }
    if (message === "LEARNING_ACCESS_MODE_INVALID" || message === "LEARNING_ACCESS_TENANT_REQUIRED") {
      return NextResponse.json({ error: "learning_access_not_configured" }, { status: 503, headers });
    }
    return NextResponse.json({ error: "coach_programs_unavailable" }, { status: 503, headers });
  }
}
