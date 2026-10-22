import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { requireLearningUser } from "@/lib/learning-server";
import { assertInstitutionDraftAdmin } from "@/lib/institutions/draft-access";
import { boundedJson, adminHeaders } from "@/lib/institutions/approval-http";
import { parseAssessmentScope, parseTransitionAssessment } from "@/lib/assessment-publication-input";
import { FirestoreAssessmentPublicationStore } from "@/lib/assessment-publication-store";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";

export const runtime = "nodejs";
type Context = { params: Promise<{ tenantId: string; programId: string }> };
const store = new FirestoreAssessmentPublicationStore(firebaseAdminFirestore);
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: adminHeaders });
const featureEnabled = () => process.env.LUMA_ASSESSMENT_PUBLICATION_ENABLED === "true";

async function authorized(request: Request, scope: { tenantId: string; programId: string },
  action: "read" | "prepare" | "review" | "publish" | "withdraw") {
  const token = await requireLearningUser(request, { checkRevoked: true });
  if (token.email_verified !== true) throw new Error("ASSESSMENT_PUBLICATION_VERIFIED_EMAIL_REQUIRED");
  assertInstitutionDraftAdmin(token as Record<string, unknown>, scope.tenantId);
  if (action === "review" && token.assessmentReviewer !== true) {
    throw new Error("ASSESSMENT_PUBLICATION_REVIEWER_REQUIRED");
  }
  if ((action === "publish" || action === "withdraw") && token.assessmentPublisher !== true) {
    throw new Error("ASSESSMENT_PUBLICATION_PUBLISHER_REQUIRED");
  }
  return token.uid;
}
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
    return reply({ error: "authentication_required" }, 401);
  }
  if (message === "ASSESSMENT_PUBLICATION_VERIFIED_EMAIL_REQUIRED" ||
    message === "ASSESSMENT_PUBLICATION_REVIEWER_REQUIRED" ||
    message === "ASSESSMENT_PUBLICATION_PUBLISHER_REQUIRED" ||
    message === "ASSESSMENT_PUBLICATION_SELF_REVIEW_FORBIDDEN" ||
    message === "ASSESSMENT_PUBLICATION_SELF_PUBLICATION_FORBIDDEN" ||
    message.startsWith("INSTITUTION_DRAFT_ADMIN_")) {
    return reply({ error: "not_authorized" }, 403);
  }
  if (message === "ASSESSMENT_PUBLICATION_NOT_FOUND") {
    return reply({ error: "assessment_plan_not_found" }, 404);
  }
  if (message === "REVIEW_CONTENT_TYPE_INVALID") return reply({ error: "json_required" }, 415);
  if (message === "REVIEW_INPUT_TOO_LARGE") return reply({ error: "request_too_large" }, 413);
  if (message.startsWith("ASSESSMENT_PUBLICATION_") || message.startsWith("INSTITUTION_DRAFT_")) {
    if (message.endsWith("_CONFLICT") || message.endsWith("_ALREADY_OPEN") ||
      message.endsWith("_CHANGED") || message.endsWith("_REUSED") ||
      message.endsWith("_UNAVAILABLE") || message.endsWith("_EXHAUSTED") ||
      message.endsWith("_FORBIDDEN") || message.endsWith("_INVALID") &&
      message.includes("OFFERING")) {
      return reply({ error: "assessment_publication_conflict" }, 409);
    }
    if (message === "ASSESSMENT_PUBLICATION_CORRUPT") {
      return reply({ error: "assessment_publication_unavailable" }, 503);
    }
    return reply({ error: "invalid_assessment_publication_input" }, 400);
  }
  return reply({ error: "assessment_publication_unavailable" }, 503);
}
async function scoped(context: Context) {
  const params = await context.params;
  return parseAssessmentScope(params.tenantId, params.programId);
}

export async function GET(request: Request, context: Context) {
  if (!featureEnabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    const scope = await scoped(context);
    await authorized(request, scope, "read");
    return reply(await store.get(scope));
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  if (!featureEnabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    const scope = await scoped(context);
    const uid = await authorized(request, scope, "prepare");
    const result = await store.prepare(scope, await boundedJson(request, 8192), uid);
    return reply({ receipt: result }, result.duplicate ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  if (!featureEnabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    const scope = await scoped(context);
    // The action is only a claimed operation name until both role and
    // tenant authorization are checked; it never grants the caller a role.
    const input = await boundedJson(request, 8192);
    const parsed = parseTransitionAssessment(scope, input);
    const uid = await authorized(request, scope, parsed.action);
    const result = await store.transition(scope, input, uid);
    return reply({ receipt: result });
  } catch (error) { return errorResponse(error); }
}
