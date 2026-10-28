/**
 * Bind a declared Firebase platform operator to a signed, nonrevoked ID token.
 * A UID supplied in a CLI flag is NOT an authentication mechanism.
 * The token must be supplied via a short-lived, secret-handled process environment,
 * never via command-line arguments or logs.
 */
export async function requireVerifiedPlatformOperator(auth, claimedUid) {
  const token = process.env.LUMA_OPERATOR_ID_TOKEN;
  if (typeof token !== 'string' || token.length < 100 || token.length > 8192) {
    throw new Error('PLATFORM_OPERATOR_SIGNED_TOKEN_REQUIRED');
  }
  let verified;
  try {
    verified = await auth.verifyIdToken(token, true);
  } catch {
    throw new Error('PLATFORM_OPERATOR_SIGNED_TOKEN_INVALID');
  }
  if (verified.uid !== claimedUid || verified.email_verified !== true ||
      !(verified.superuser === true || verified.role === 'superuser')) {
    throw new Error('PLATFORM_OPERATOR_TOKEN_IDENTITY_MISMATCH');
  }
  const actor = await auth.getUser(claimedUid);
  if (actor.disabled || !actor.emailVerified ||
      actor.email?.trim().toLowerCase() !== verified.email?.trim().toLowerCase() ||
      !(actor.customClaims?.superuser === true || actor.customClaims?.role === 'superuser')) {
    throw new Error('PLATFORM_OPERATOR_NOT_AUTHORIZED');
  }
  return actor;
}
