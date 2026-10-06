const METADATA_IDENTITY_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";

const TOKEN_REFRESH_SKEW_MS = 60_000;
const METADATA_TIMEOUT_MS = 5_000;

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

const tokenCache = new Map<string, CachedToken>();

function parseJwtExpiryMs(token: string): number {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Google identity token is not a JWT");

  const payload = JSON.parse(
    Buffer.from(parts[1], "base64url").toString("utf8"),
  ) as { exp?: unknown };

  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    throw new Error("Google identity token has no valid expiry");
  }
  return payload.exp * 1000;
}

export async function getGoogleIdentityToken(
  audience: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const now = Date.now();
  const cached = tokenCache.get(audience);
  if (cached && cached.expiresAtMs - TOKEN_REFRESH_SKEW_MS > now) {
    return cached.token;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);

  try {
    const url = new URL(METADATA_IDENTITY_URL);
    url.searchParams.set("audience", audience);
    url.searchParams.set("format", "full");

    const response = await fetchImpl(url, {
      headers: { "Metadata-Flavor": "Google" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Google metadata identity request failed: ${response.status}`);
    }

    const token = (await response.text()).trim();
    const expiresAtMs = parseJwtExpiryMs(token);
    tokenCache.set(audience, { token, expiresAtMs });
    return token;
  } finally {
    clearTimeout(timeout);
  }
}

export function clearGoogleIdentityTokenCacheForTests() {
  tokenCache.clear();
}
