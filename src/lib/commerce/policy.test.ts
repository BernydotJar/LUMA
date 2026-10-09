import { describe, expect, it } from "vitest";
import { entitlementActionForCommerceEvent } from "./policy";
import type { CommerceEventType } from "./domain";

describe("commerce entitlement policy", () => {
  const expected: Array<[CommerceEventType, string]> = [
    ["commerce.payment.confirmed", "grant"],
    ["commerce.subscription.created", "grant"],
    ["commerce.subscription.pending", "none"],
    ["commerce.subscription.renewed", "grant"],
    ["commerce.payment.refunded", "revoke"],
    ["commerce.subscription.cancellation_scheduled", "none"],
    ["commerce.subscription.cancelled", "revoke"],
    ["commerce.subscription.expired", "revoke"],
    ["commerce.payment.failed", "none"],
    ["commerce.payment.partially_refunded", "none"],
  ];

  it.each(expected)("%s -> %s", (type, action) => {
    expect(
      entitlementActionForCommerceEvent({ type }),
    ).toBe(action);
  });
});
