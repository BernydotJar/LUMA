import { describe, expect, it } from "vitest";
import {
  commerceIdempotencyKey,
  compareCommerceEventTimes,
  commerceTimestampNanos,
  entitlementIdentityKey,
  processingIntentMatches,
  type NormalizedCommerceEvent,
  type ProviderEventRecord,
} from "./domain";

describe("LUMA V2 commerce domain", () => {
  it("preserves sub-millisecond ordering through nanoseconds", () => {
    expect(
      compareCommerceEventTimes(
        "2026-10-07T12:00:00.000001Z",
        "2026-10-07T12:00:00.000999Z",
      ),
    ).toBe(-1);
    expect(
      compareCommerceEventTimes(
        "2026-10-07T12:00:00.000999Z",
        "2026-10-07T12:00:00.000001Z",
      ),
    ).toBe(1);
  });

  it("rejects provider timestamps beyond nanosecond precision", () => {
    expect(() =>
      commerceTimestampNanos(
        "2026-10-07T12:00:00.1234567891Z",
      ),
    ).toThrow(/nanosecond precision/i);
  });

  it("rejects calendar-invalid RFC3339 timestamps instead of normalizing them", () => {
    expect(() =>
      commerceTimestampNanos("2026-02-30T00:00:00Z"),
    ).toThrow(/valid RFC3339 timestamp/i);
    expect(() =>
      commerceTimestampNanos("2026-04-31T00:00:00Z"),
    ).toThrow(/valid RFC3339 timestamp/i);
    expect(() =>
      commerceTimestampNanos("2026-01-01T24:00:00Z"),
    ).toThrow(/valid RFC3339 timestamp/i);
  });

  it("rejects RFC3339 unknown local offsets instead of treating them as UTC", () => {
    expect(() =>
      commerceTimestampNanos("2026-10-07T12:00:00-00:00"),
    ).toThrow(/valid RFC3339 timestamp/i);
    expect(
      compareCommerceEventTimes(
        "2026-10-07T12:00:00Z",
        "2026-10-07T12:00:00+00:00",
      ),
    ).toBe(0);
  });

  it("accepts lowercase RFC3339 date-time designators", () => {
    expect(
      compareCommerceEventTimes(
        "2026-10-07t12:00:00.123456789z",
        "2026-10-07T12:00:00.123456789Z",
      ),
    ).toBe(0);
  });

  it("accepts leap-day and compares equivalent timezone offsets", () => {
    expect(() =>
      commerceTimestampNanos("2028-02-29T23:59:59.123456789Z"),
    ).not.toThrow();
    expect(
      compareCommerceEventTimes(
        "2026-10-07T12:00:00.123456789Z",
        "2026-10-07T14:00:00.123456789+02:00",
      ),
    ).toBe(0);
  });

  it("derives a provider-scoped idempotency key", () => {
    const event: NormalizedCommerceEvent = {
      provider: "hotmart",
      externalEventId: "purchase-42",
      type: "commerce.payment.confirmed",
      occurredAt: "2026-10-07T00:00:00Z",
    };

    expect(commerceIdempotencyKey(event)).toBe(
      '["hotmart","purchase-42"]',
    );
  });

  it("encodes provider and event ids without delimiter collisions", () => {
    expect(
      commerceIdempotencyKey({
        provider: "a:b",
        externalEventId: "c",
      }),
    ).not.toBe(
      commerceIdempotencyKey({
        provider: "a",
        externalEventId: "b:c",
      }),
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


  it("uses unambiguous entitlement identity encoding even when ids contain delimiters", () => {
    expect(
      entitlementIdentityKey({
        tenantId: "tenant",
        customerId: "a:b",
        productId: "c",
      }),
    ).not.toBe(
      entitlementIdentityKey({
        tenantId: "tenant",
        customerId: "a",
        productId: "b:c",
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
    ).toBe('["tenant-a","c-1","p-1"]');
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
