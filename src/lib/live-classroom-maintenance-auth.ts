import { OAuth2Client } from "google-auth-library";

export type MaintenanceAuthDecision =
  | { ok: true; principal: string }
  | { ok: false; status: 401 | 403 | 503; reason: string };

/**
 * Cloud Scheduler must mint a Google-signed OIDC *ID* token, not a Firebase user
 * token or a shared static cron secret. Exact audience + service-account email
 * prevents cross-service token replay. The route remains closed if unconfigured.
 */
export async function verifyClassroomMaintenanceCaller(
  request: Request,
  configuration: {
    audience?: string;
    principal?: string;
    verifyToken?: (idToken: string, audience: string) => Promise<{
      email?: string;
      email_verified?: boolean;
      iss?: string;
    } | undefined>;
  } = {
    audience: process.env.LUMA_LIVE_MAINTENANCE_AUDIENCE,
    principal: process.env.LUMA_LIVE_MAINTENANCE_PRINCIPAL,
  },
): Promise<MaintenanceAuthDecision> {
  const { audience, principal } = configuration;
  if (!audience?.startsWith("https://") ||
      !principal?.endsWith(".gserviceaccount.com") ||
      !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(principal)) {
    return { ok: false, status: 503, reason: "maintenance_unconfigured" };
  }

  const header = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.\-]+$/.test(header)) {
    return { ok: false, status: 401, reason: "maintenance_auth_required" };
  }
  const idToken = header.slice(7);
  try {
    const verifyToken = configuration.verifyToken ??
      (async (token: string, targetAudience: string) => {
        const ticket = await new OAuth2Client().verifyIdToken({
          idToken: token,
          audience: targetAudience,
        });
        return ticket.getPayload();
      });
    const payload = await verifyToken(idToken, audience);
    if (payload?.email !== principal ||
        payload.email_verified !== true ||
        !["accounts.google.com", "https://accounts.google.com"].includes(payload.iss ?? "")) {
      return { ok: false, status: 403, reason: "maintenance_principal_denied" };
    }
    return { ok: true, principal };
  } catch {
    return { ok: false, status: 401, reason: "maintenance_invalid_identity" };
  }
}
