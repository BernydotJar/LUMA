import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { commerceEnrollments } from "@/lib/commerce/server";
import { isActiveCommerceEnrollment } from "@/lib/commerce/enrollment";
import { resolveLearningAccessPolicy } from "@/lib/learning-entitlement";
import { requireLearningUser } from "@/lib/learning-server";
import { programDeliveryStore } from "@/lib/program-delivery-server";

export const runtime = "nodejs";
const responseHeaders = { "cache-control": "private, no-store" };

/**
 * Read-only curriculum selection for the authenticated learner.
 * Server-derived entitlements are the sole course authority; browser storage
 * and requested program IDs never grant access.
 */
export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request, { checkRevoked: true });
    const policy = resolveLearningAccessPolicy(process.env);
    if (policy.mode === "showcase") {
      return NextResponse.json({ mode: "showcase", courses: [] }, { headers: responseHeaders });
    }
    const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
    if (!email || user.email_verified !== true) {
      return NextResponse.json({ error: "verified_email_required" }, { status: 403, headers: responseHeaders });
    }

    // Verified email claims institutional or paid admissions; repeated calls
    // are idempotent and never forge a merchant transaction.
    await commerceEnrollments.claimByEmail(user.uid, email, policy.tenantId);
    const enrollments = (await commerceEnrollments.listByLearner(user.uid))
      .filter((item) => item.tenantId === policy.tenantId &&
        item.learnerId === user.uid && isActiveCommerceEnrollment(item));

    // Distinct program IDs match the learning-plan entitlement boundary.
    // Do not show every cohort in a tenant, only claimed live entitlements.
    const access = enrollments.filter((item) => item.offeringId)
      .map((item) => ({
        tenantId: item.tenantId, programId: item.programId,
        offeringId: item.offeringId!,
      }));
    const offerings = await programDeliveryStore.listOfferingsForPrograms(access);
    const lookup = new Map(offerings.map((o) => [o.programId, o]));
    const courses = [...new Set(enrollments.map((e) => e.programId))]
      .sort().map((programId) => {
        const offering = lookup.get(programId);
        return {
          tenantId: policy.tenantId,
          programId,
          title: offering?.title ?? "Programa pendiente de publicación",
          ...(offering ? {
            offeringId: offering.offeringId,
            deliveryMode: offering.deliveryMode,
            timezone: offering.timezone,
          } : {}),
          publishedOfferingAvailable: Boolean(offering),
        };
      });

    return NextResponse.json({ mode: "entitled", courses }, { headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401, headers: responseHeaders });
    }
    if (message === "ENROLLMENT_ALREADY_CLAIMED") {
      return NextResponse.json({ error: "enrollment_claim_conflict" }, { status: 409, headers: responseHeaders });
    }
    if (message === "LEARNING_ACCESS_MODE_INVALID" || message === "LEARNING_ACCESS_TENANT_REQUIRED") {
      return NextResponse.json({ error: "learning_access_not_configured" }, { status: 503, headers: responseHeaders });
    }
    return NextResponse.json({ error: "my_courses_unavailable" }, { status: 503, headers: responseHeaders });
  }
}
