import { describe, expect, it } from "vitest";
import { enforceCommerceWebhookRateLimit, readCommerceWebhookBody } from "./webhook-security";

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

  it("rate limits a repeated client before body parsing", () => {
    const request = new Request("https://example.test/webhook", {
      headers: { "x-forwarded-for": "203.0.113.77" },
    });
    enforceCommerceWebhookRateLimit("stripe", request, { nowMs: 10_000, clientLimit: 2, providerLimit: 10 });
    enforceCommerceWebhookRateLimit("stripe", request, { nowMs: 10_001, clientLimit: 2, providerLimit: 10 });
    expect(() =>
      enforceCommerceWebhookRateLimit("stripe", request, { nowMs: 10_002, clientLimit: 2, providerLimit: 10 }),
    ).toThrow("WEBHOOK_RATE_LIMITED");
  });
});
