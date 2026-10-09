import { createSign } from "node:crypto";

export function docusignSettings() {
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID?.trim();
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY?.trim();
  const userId = process.env.DOCUSIGN_IMPERSONATED_USER_ID?.trim();
  const pem = process.env.DOCUSIGN_PRIVATE_KEY_PEM?.replace(/\\n/g, "\n");
  const oauthHost = process.env.DOCUSIGN_OAUTH_HOST || "account-d.docusign.com";
  const apiBase = process.env.DOCUSIGN_API_BASE_URL || "https://demo.docusign.net/restapi";
  if (!accountId || !integrationKey || !userId || !pem) throw new Error("SIGNING_NOT_CONFIGURED");
  if (!/^[\w-]{10,100}$/.test(accountId) || !/^[\w-]{10,100}$/.test(integrationKey) ||
      !/^[\w-]{10,100}$/.test(userId) ||
      !["account-d.docusign.com", "account.docusign.com"].includes(oauthHost)) {
    throw new Error("SIGNING_CONFIGURATION_INVALID");
  }
  let url: URL;
  try { url = new URL(apiBase); } catch { throw new Error("SIGNING_CONFIGURATION_INVALID"); }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".docusign.net") ||
      url.pathname.replace(/\/$/, "") !== "/restapi" || url.search || url.hash) {
    throw new Error("SIGNING_CONFIGURATION_INVALID");
  }
  return { accountId, integrationKey, userId, pem, oauthHost, apiBase: url.origin + "/restapi" };
}

type Settings = ReturnType<typeof docusignSettings>;
export async function docusignAccessToken(config: Settings): Promise<string> {
  const encode = (data: unknown) => Buffer.from(JSON.stringify(data)).toString("base64url");
  const time = Math.floor(Date.now() / 1000);
  const message = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: config.integrationKey, sub: config.userId, aud: config.oauthHost,
    iat: time - 10, exp: time + 3500, scope: "signature impersonation",
  })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  const assertion = `${message}.${signer.sign(config.pem).toString("base64url")}`;
  const response = await fetch(`https://${config.oauthHost}/oauth/token`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("SIGNING_AUTH_FAILED");
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("SIGNING_AUTH_FAILED");
  return body.access_token;
}

export async function docusignRequest(
  path: string, options?: { method?: string; body?: unknown },
): Promise<Response> {
  const config = docusignSettings();
  const token = await docusignAccessToken(config);
  const response = await fetch(
    `${config.apiBase}/v2.1/accounts/${encodeURIComponent(config.accountId)}${path}`, {
      method: options?.method || "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(options?.body ? { "content-type": "application/json" } : {}),
      },
      ...(options?.body ? { body: JSON.stringify(options.body) } : {}),
      signal: AbortSignal.timeout(30000),
    },
  );
  if (!response.ok) throw new Error(`SIGNING_PROVIDER_HTTP_${response.status}`);
  return response;
}
