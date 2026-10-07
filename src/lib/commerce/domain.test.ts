import { describe, expect, it } from "vitest";
import {
  commerceIdempotencyKey,
  entitlementIdentityKey,
  processingIntentMatches,
  type NormalizedCommerceEvent,
  type ProviderEventRecord,
} from "./domain";

describe("LUMA V2 commerce domain", () => {
  it("derives a provider-scoped idempotency key", () => {
    const event: NormalizedCommerceEvent = {
      provider: "hotmart",
      externalEventId: "purchase-42",
      type: "commerce.payment.confirmed",
      occurredAt: "2026-10-07T00:00:00Z",
    };

    expect(commerceIdempotencyKey(event)).toBe(
      "hotmart:purchase-42",
    );
  });

  it("keeps equal external ids distinct across providers", () => {
    expect(
      commerceIdempotencyKey({
        provider: "hotmart",
        externalEventId: "42",
      }),
    ).not.toBe(
      commerceIdempotencyKey({
        provider: "stripe",
        externalEventId: "42",
      }),
    );
  });

  it("scopes entitlement identity by tenant, customer and product", () => {
    expect(
      entitlementIdentityKey({
        tenantId: "tenant-a",
        customerId: "c-1",
        productId: "p-1",
      }),
    ).not.toBe(
      entitlementIdentityKey({
        tenantId: "tenant-b",
        customerId: "c-1",
        productId: "p-1",
      }),
    );
  });

  it("normalizes entitlement identity whitespace", () => {
    expect(
      entitlementIdentityKey({
        tenantId: " tenant-a ",
        customerId: " c-1 ",
        productId: " p-1 ",
      }),
    ).toBe("tenant-a:c-1:p-1");
  });

  it("rejects incomplete identities", () => {
    expect(() =>
      commerceIdempotencyKey({
        provider: "stripe",
        externalEventId: " ",
      }),
    ).toThrow();

    expect(() =>
      entitlementIdentityKey({
        tenantId: " ",
        customerId: "c-1",
        productId: "p-1",
      }),
    ).toThrow();
  });

  it("requires processed replay resolution to match the original tenant and action", () => {
    const processed = {
      resolution: {
        tenantId: "tenant-a",
        customerId: "customer-1",
        productId: "program-1",
        entitlementId: "ent-1",
        action: "grant",
      },
    } satisfies Pick<ProviderEventRecord, "resolution">;

    expect(
      processingIntentMatches(
        processed,
        "grant",
        {
          tenantId: "tenant-a",
          customerId: "customer-1",
          productId: "program-1",
        },
      ),
    ).toBe(true);

    expect(
      processingIntentMatches(
        processed,
        "grant",
        {
          tenantId: "tenant-b",
          customerId: "customer-1",
          productId: "program-1",
        },
      ),
    ).toBe(false);

    expect(
      processingIntentMatches(
        processed,
        "revoke",
        {
          tenantId: "tenant-a",
          customerId: "customer-1",
          productId: "program-1",
        },
      ),
    ).toBe(false);

    expect(
      processingIntentMatches(
        processed,
        "none",
      ),
    ).toBe(false);
  });

  it("accepts a no-op replay only when no entitlement resolution was recorded", () => {
    expect(
      processingIntentMatches(
        { resolution: undefined },
        "none",
      ),
    ).toBe(true);
  });
});
