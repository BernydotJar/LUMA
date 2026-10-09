/** Recognize credential rejection without mistaking Firebase service failure for invalid access. */
const tokenRejectionCodes = new Set([
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/argument-error",
]);

export function isRejectedFirebaseToken(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && tokenRejectionCodes.has(code);
}
