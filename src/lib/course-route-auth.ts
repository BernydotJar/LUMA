import { NextResponse } from "next/server";
import { requireLearningUser } from "./learning-server";
import { requireLearningEntitlement } from "./learning-entitlement-server";
import { resolveLearningAccessPolicy, learningAccessFailure } from "./learning-entitlement";
import { isRejectedFirebaseToken } from "./auth-token-error";

/** Fail closed for premium lesson delivery, including the public showcase deployment. */
export async function requireAuthorizedCourse(request: Request) {
  if (resolveLearningAccessPolicy(process.env).mode !== "entitled") {
    throw new Error("COURSE_DELIVERY_NOT_ENABLED");
  }
  const learner = await requireLearningUser(request, { checkRevoked: true });
  const scope = await requireLearningEntitlement(learner, request.headers.get("x-luma-program-id"));
  if (!scope) throw new Error("COURSE_DELIVERY_NOT_ENABLED");
  return { learner, scope };
}

export function courseError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401, headers: courseNoStoreHeaders });
  }
  if (message === "COURSE_DELIVERY_NOT_ENABLED" || message === "COURSE_MEDIA_NOT_CONFIGURED" ||
      message === "COURSE_MEDIA_SIGNING_FAILED") {
    return NextResponse.json({ error: "course_delivery_unavailable" }, { status: 503, headers: courseNoStoreHeaders });
  }
  const entitlement = learningAccessFailure(error);
  if (entitlement) return NextResponse.json({ error: entitlement.error }, { status: entitlement.status, headers: courseNoStoreHeaders });
  if (message === "COURSE_LESSON_NOT_AVAILABLE") {
    return NextResponse.json({ error: "lesson_not_available" }, { status: 404, headers: courseNoStoreHeaders });
  }
  if (message === "COURSE_LESSON_REVISION_CHANGED") {
    return NextResponse.json({ error: "lesson_revision_changed" }, { status: 409, headers: courseNoStoreHeaders });
  }
  if (["COURSE_CURSOR_INVALID", "COURSE_LESSON_ID_INVALID", "COURSE_CHECKPOINT_INVALID",
       "COURSE_PAGE_SIZE_INVALID"].includes(message)) {
    return NextResponse.json({ error: "invalid_course_request" }, { status: 400, headers: courseNoStoreHeaders });
  }
  return NextResponse.json({ error: "course_delivery_unavailable" }, { status: 503, headers: courseNoStoreHeaders });
}

export const courseNoStoreHeaders = { "cache-control": "private, no-store, max-age=0" };
