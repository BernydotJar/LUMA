import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGoogleIdentityTokenCacheForTests,
  getGoogleIdentityToken,
} from "./google-oidc";

function tokenWithExpiry(exp: number) {
  const head = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${head}.${body}.sig`;
}

afterEach(() => {
  clearGoogleIdentityTokenCacheForTests();
  vi.restoreAllMocks();
});

describe("getGoogleIdentityToken", () => {
  it("requests a Google metadata identity token for the exact audience", async () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600);
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain("metadata.google.internal");
      expect(url).toContain(`audience=${encodeURIComponent("https://voice.example")}`);
      expect(init?.headers).toEqual({ "Metadata-Flavor": "Google" });
      return new Response(token, { status: 200 });
    }) as typeof fetch;

    await expect(getGoogleIdentityToken("https://voice.example", fetchImpl)).resolves.toBe(token);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reuses a non-expiring cached token", async () => {
    const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600);
    const fetchImpl = vi.fn(async () => new Response(token, { status: 200 })) as typeof fetch;

    await getGoogleIdentityToken("https://voice.example", fetchImpl);
    await getGoogleIdentityToken("https://voice.example", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
