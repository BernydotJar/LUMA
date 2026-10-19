import { firebaseAdminAuth, firebaseAdminFirestore } from "@/lib/firebase-admin";
import { institutionDraftStore } from "@/lib/institution-config-server";
import { authorizedAdminTenants } from "@/lib/tenant-admin-access";
import { academyApprovalStore } from "@/lib/institutions/review-server";
import { approvalEnabled, approvalError, boundedJson, platformOperator, reply } from "@/lib/institutions/approval-http";
import { parseDraftRequestId } from "@/lib/institutions/draft-input";
export const runtime = "nodejs";
type Context = { params: Promise<{ applicationId: string }> };

/** Explicit platform-only initial draft, still NOT a tenant publication endpoint. */
export async function POST(request: Request, context: Context) {
  if (!approvalEnabled() || process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED !== "true") {
    return reply({ error: "feature_unavailable" }, 503);
  }
  try {
    const actor = await platformOperator(request);
    const applicationId = (await context.params).applicationId;
    const input = await boundedJson(request);
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.getPrototypeOf(input) !== Object.prototype) return reply({ error: "invalid_request" }, 400);
    const raw = input as Record<string, unknown>;
    if (Object.keys(raw).length !== 1) return reply({ error: "invalid_request" }, 400);
    const requestId = parseDraftRequestId(raw.requestId);
    const application = await academyApprovalStore.getForOperator(applicationId);
    if (!application) return reply({ error: "application_not_found" }, 404);
    if (application.status !== "activated" || !application.tenantId || !application.initialProgramId ||
        !application.activationAuditId) return reply({ error: "activation_required" }, 409);
    const user = await firebaseAdminAuth.getUser(application.applicantUid);
    if (user.disabled || !user.emailVerified ||
        user.email?.toLowerCase().trim() !== application.applicantEmail ||
        user.customClaims?.admin !== true ||
        !authorizedAdminTenants(user.customClaims).includes(application.tenantId)) {
      return reply({ error: "owner_role_not_provisioned" }, 409);
    }
    const reservation = await firebaseAdminFirestore.collection("institutionOnboardingTenants")
      .doc(application.tenantId).get();
    if (!reservation.exists || reservation.data()?.applicationId !== applicationId ||
        reservation.data()?.status !== "activated") return reply({ error: "tenant_not_confirmed" }, 409);
    const result = await institutionDraftStore.createDraft({
      tenantId: application.tenantId, templateId: "luma-platform",
      programIds: [application.initialProgramId], expectedVersion: 0,
      reasonCode: "institution-onboarding", requestId,
    }, actor.uid);
    return reply({ draft: result }, result.duplicate ? 200 : 201);
  } catch (error) { return approvalError(error); }
}
