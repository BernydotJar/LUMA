import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";

export function certificateError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const status =
    message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error) ? 401 :
    ["COACH_REQUIRED", "COACH_SCOPE_REQUIRED", "ADMIN_REQUIRED",
     "CERTIFICATE_FORBIDDEN", "CERTIFICATE_NOT_ACCESSIBLE", "TENANT_ADMIN_FORBIDDEN", "TENANT_ADMIN_REQUIRED"].includes(message) ? 403 :
    message === "CERTIFICATE_NOT_FOUND" || message === "CERTIFICATE_OFFERING_NOT_FOUND" ? 404 :
    ["CERTIFICATE_COMPLETION_ALREADY_APPROVED", "CERTIFICATE_COMPLETION_REQUIRED",
     "CERTIFICATE_ENROLLMENT_REQUIRED", "CERTIFICATE_VERIFIED_LEARNER_IDENTITY_REQUIRED",
     "CERTIFICATE_NOT_SIGNED", "CERTIFICATE_INVALID_STATE"].includes(message) ? 409 :
    message === "TENANT_ADMIN_SCOPE_INVALID" || message.startsWith("CERTIFICATE_INVALID_") ||
    message.endsWith("_TOO_SHORT") ? 400 :
    message === "CERTIFICATE_INSTITUTIONAL_SIGNING_NOT_AUTHORIZED" ? 409 :
    message === "STIRLING_TENANT_NOT_AUTHORIZED" ? 403 :
    message.startsWith("STIRLING_") ? 503 :
    message.endsWith("_NOT_CONFIGURED") ? 503 : 500;
  // Never leak provider credentials, learner data, tokens, or upstream error bodies.
  const safe = status === 500 ? "certificate_service_unavailable" :
    status === 503 ? "certificate_configuration_required" :
    status === 401 ? "authentication_required" :
    status === 403 ? "not_authorized" : message.toLowerCase();
  return NextResponse.json({ error: safe }, { status, headers: { "cache-control": "no-store" } });
}
