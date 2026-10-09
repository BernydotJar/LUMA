import { describe, expect, it } from "vitest";
import {
  enforceCommerceWebhookClientRateLimit,
  enforceCommerceWebhookProviderRateLimit,
  readCommerceWebhookBody,
} from "./webhook-security";

describe("commerce webhook ingress security", () => {
  it("rejects declared oversized bodies before buffering", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "content-length": "300000" },
      body: "{}",
    });
    await expect(readCommerceWebhookBody(request, 1024)).rejects.toThrow("WEBHOOK_BODY_TOO_LARGE");
  });

  it("rejects streamed bodies that exceed the hard limit", async () => {
    const request = new Request("https://example.test/webhook", {
      method: "POST",
      body: "x".repeat(2048),
    });
    await expect(readCommerceWebhookBody(request, 1024)).rejects.toThrow("WEBHOOK_BODY_TOO_LARGE");
  });

  it("an unauthenticated flood does not spend the shared provider quota", () => {
    const attacker = new Request("https://example.test/webhook", {
      headers: { "x-forwarded-for": "198.51.100.99" },
    });
    const legitimate = new Request("https://example.test/webhook", {
      headers: { "x-forwarded-for": "198.51.100.22" },
    });
    // These client-only calls represent events rejected at signature verification.
    for (let index = 0; index < 180; index++) {
      enforceCommerceWebhookClientRateLimit("hotmart", attacker, { nowMs: 70_000, clientLimit: 180 });
    }
    expect(() => enforceCommerceWebhookClientRateLimit("hotmart", attacker, {
      nowMs: 70_001, clientLimit: 180,
    })).toThrow("WEBHOOK_RATE_LIMITED");
    // A different client still gets in, and authentic events spend the provider bucket.
    enforceCommerceWebhookClientRateLimit("hotmart", legitimate, { nowMs: 70_001, clientLimit: 180 });
    enforceCommerceWebhookProviderRateLimit("hotmart", { nowMs: 70_001, providerLimit: 2 });
    enforceCommerceWebhookProviderRateLimit("hotmart", { nowMs: 70_002, providerLimit: 2 });
    expect(() => enforceCommerceWebhookProviderRateLimit("hotmart", {
      nowMs: 70_003, providerLimit: 2,
    })).toThrow("WEBHOOK_RATE_LIMITED");
  });

  it("bounds the fingerprint table during a rotating-IP burst", () => {
    for (let index = 0; index < 2_300; index++) {
      const request = new Request("https://example.test/webhook", {
        headers: { "x-forwarded-for": `192.0.${Math.floor(index / 256)}.${index % 256}` },
      });
      enforceCommerceWebhookClientRateLimit("hotmart", request, {
        nowMs: 900_000, clientLimit: 1,
      });
    }
    const state = (globalThis as typeof globalThis & {
      __lumaCommerceWebhookRateState?: Map<string, unknown>
    }).__lumaCommerceWebhookRateState;
    expect(state?.size).toBeLessThanOrEqual(2_048);
    // Attackers cannot evict the authenticated provider quota by changing IPs.
    enforceCommerceWebhookProviderRateLimit("hotmart", { nowMs: 900_001, providerLimit: 2 });
  });

  it("rate limits a repeated client before body parsing", () => {
    const request = new Request("https://example.test/webhook", {
      headers: { "x-forwarded-for": "203.0.113.77" },
    });
    enforceCommerceWebhookClientRateLimit("stripe", request, { nowMs: 10_000, clientLimit: 2 });
    enforceCommerceWebhookClientRateLimit("stripe", request, { nowMs: 10_001, clientLimit: 2 });
    expect(() =>
      enforceCommerceWebhookClientRateLimit("stripe", request, { nowMs: 10_002, clientLimit: 2 }),
    ).toThrow("WEBHOOK_RATE_LIMITED");
  });
});
