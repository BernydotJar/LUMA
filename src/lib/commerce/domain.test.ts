import { describe, expect, it } from "vitest";
import { commerceIdempotencyKey, type NormalizedCommerceEvent } from "./domain";

describe("LUMA V2 commerce domain", () => {
  it("derives a provider-scoped idempotency key", () => {
    const event: NormalizedCommerceEvent = { provider: "hotmart", externalEventId: "purchase-42", type: "commerce.payment.confirmed", occurredAt: "2026-10-07T00:00:00Z" };
    expect(commerceIdempotencyKey(event)).toBe("hotmart:purchase-42");
  });

  it("keeps equal external ids distinct across providers", () => {
    expect(commerceIdempotencyKey({ provider: "hotmart", externalEventId: "42" })).not.toBe(
      commerceIdempotencyKey({ provider: "stripe", externalEventId: "42" }),
    );
  });

  it("rejects incomplete idempotency identity", () => {
    expect(() => commerceIdempotencyKey({ provider: "stripe", externalEventId: " " })).toThrow();
  });
});
