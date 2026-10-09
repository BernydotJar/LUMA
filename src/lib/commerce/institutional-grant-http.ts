import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";

export function institutionalGrantError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  const status =
    message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error) ? 401 :
    message === "ADMIN_REQUIRED" || message === "INSTITUTIONAL_ADMIN_REQUIRED" ||
    message === "INSTITUTIONAL_TENANT_FORBIDDEN" ? 403 :
    message === "INSTITUTIONAL_GRANT_NOT_FOUND" ? 404 :
    message.endsWith("_CONFLICT") || message === "INSTITUTIONAL_OFFERING_NOT_ACTIVE" ||
    message === "INSTITUTIONAL_REACTIVATION_CONFIRMATION_REQUIRED" ? 409 :
    message.startsWith("INSTITUTIONAL_") ? 400 : 500;
  return NextResponse.json({
    error: status === 500 ? "institutional_enrollment_unavailable" : message.toLowerCase(),
  }, { status, headers: { "cache-control": "no-store" } });
}
