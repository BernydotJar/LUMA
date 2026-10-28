import { NextResponse } from "next/server";
import { requireLearningAdmin, requireLearningUser } from "@/lib/learning-server";
import { isPlatformSuperuser } from "@/lib/tenant-admin-access";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import type { DecodedIdToken } from "firebase-admin/auth";

export const adminHeaders = {
  "cache-control": "private, no-store", "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff", "x-robots-tag": "noindex, nofollow",
};
export const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: adminHeaders });
export const approvalEnabled = () => process.env.LUMA_INSTITUTION_APPROVAL_ENABLED === "true";

export async function platformOperator(request: Request): Promise<DecodedIdToken> {
  const token = await requireLearningAdmin(request);
  if (!isPlatformSuperuser(token as Record<string, unknown>)) throw new Error("OPERATOR_REQUIRED");
  return token;
}
export async function applicantIdentity(request: Request) {
  const user = await requireLearningUser(request, { checkRevoked: true });
  const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";
  if (user.email_verified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("INVITATION_VERIFIED_EMAIL_REQUIRED");
  }
  return { uid: user.uid, email };
}

export async function boundedJson(request: Request, max = 4096): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new Error("REVIEW_CONTENT_TYPE_INVALID");
  }
  if (!request.body) throw new Error("REVIEW_INPUT_INVALID");
  const head = Number(request.headers.get("content-length"));
  if (request.headers.has("content-length") && Number.isFinite(head) && head > max) {
    throw new Error("REVIEW_INPUT_TOO_LARGE");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > max) { await reader.cancel(); throw new Error("REVIEW_INPUT_TOO_LARGE"); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new Error("REVIEW_INPUT_INVALID"); }
}

export function approvalError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) return reply({ error: "authentication_required" }, 401);
  if (["ADMIN_REQUIRED", "OPERATOR_REQUIRED", "REVIEW_SELF_ACTION_FORBIDDEN",
    "REVIEW_TWO_PERSON_REQUIRED", "INVITATION_VERIFIED_EMAIL_REQUIRED"].includes(code)) {
    return reply({ error: "not_authorized" }, 403);
  }
  if (code === "REVIEW_NOT_FOUND") return reply({ error: "application_not_found" }, 404);
  if (code === "INVITATION_EXPIRED") return reply({ error: "invitation_expired" }, 410);
  if (code === "INVITATION_INVALID") return reply({ error: "invalid_invitation" }, 403);
  if (["REVIEW_STATE_CONFLICT", "REVIEW_TENANT_TAKEN", "REVIEW_INVITATION_CONFLICT",
       "REVIEW_RESERVATION_INVALID", "REVIEW_RECORD_INVALID",
       "REVIEW_ACTIVATION_IN_PROGRESS"].includes(code)) {
    return reply({ error: "review_conflict" }, 409);
  }
  if (code === "REVIEW_PAGE_INVALID" || code === "REVIEW_ID_INVALID" ||
      code === "REVIEW_INPUT_INVALID" || code === "REVIEW_STATE_INVALID" ||
      code === "INSTITUTION_DRAFT_TENANT_INVALID") return reply({ error: "invalid_request" }, 400);
  if (code === "REVIEW_CONTENT_TYPE_INVALID") return reply({ error: "json_required" }, 415);
  if (code === "REVIEW_INPUT_TOO_LARGE") return reply({ error: "request_too_large" }, 413);
  if (code === "APPLICATION_RATE_LIMITED") return reply({ error: "rate_limited" }, 429);
  return reply({ error: "institution_review_unavailable" }, 503);
}
