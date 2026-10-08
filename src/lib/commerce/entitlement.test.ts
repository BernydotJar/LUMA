import { describe, expect, it } from "vitest";
import { applyEntitlementTransition } from "./entitlement";
import type { EntitlementIdentity, NormalizedCommerceEvent } from "./domain";

const identity: EntitlementIdentity = {
  tenantId: "tenant-a",
  customerId: "customer-1",
  productId: "program-1",
};

function event(
  externalEventId: string,
  type: NormalizedCommerceEvent["type"],
  occurredAt: string,
): NormalizedCommerceEvent {
  return {
    provider: "stripe",
    externalEventId,
    type,
    occurredAt,
  };
}

describe("entitlement lifecycle", () => {
  it("grants a first entitlement", () => {
    const result = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "grant",
      event: event(
        "evt-pay",
        "commerce.payment.confirmed",
        "2026-10-07T12:00:00Z",
      ),
      appliedAt: "2026-10-07T12:00:01Z",
    });

    expect(result.outcome).toBe("granted");
    expect(result.record.status).toBe("active");
    expect(result.record.version).toBe(1);
  });

  it("creates a revocation tombstone so an older delayed grant cannot restore access", () => {
    const refund = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "revoke",
      event: event(
        "evt-refund",
        "commerce.payment.refunded",
        "2026-10-07T12:10:00Z",
      ),
      appliedAt: "2026-10-07T12:10:01Z",
    });

    const delayedPayment = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "grant",
      event: event(
        "evt-pay",
        "commerce.payment.confirmed",
        "2026-10-07T12:00:00Z",
      ),
      appliedAt: "2026-10-07T12:11:00Z",
      current: refund.record,
    });

    expect(delayedPayment.outcome).toBe("ignored_stale");
    expect(delayedPayment.record.status).toBe("revoked");
    expect(delayedPayment.changed).toBe(false);
  });

  it("lets revocation win when grant and revoke have the same provider timestamp", () => {
    const grant = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "grant",
      event: event(
        "evt-pay",
        "commerce.payment.confirmed",
        "2026-10-07T12:00:00Z",
      ),
      appliedAt: "2026-10-07T12:00:01Z",
    });

    const revoke = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "revoke",
      event: event(
        "evt-refund",
        "commerce.payment.refunded",
        "2026-10-07T12:00:00Z",
      ),
      appliedAt: "2026-10-07T12:00:02Z",
      current: grant.record,
    });

    expect(revoke.record.status).toBe("revoked");
    expect(revoke.outcome).toBe("revoked");
  });

  it("preserves sub-millisecond provider ordering", () => {
    const revoked = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "revoke",
      event: event(
        "evt-refund",
        "commerce.payment.refunded",
        "2026-10-07T12:00:00.000001Z",
      ),
      appliedAt: "2026-10-07T12:00:01Z",
    });

    const newerGrant = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "grant",
      event: event(
        "evt-renew",
        "commerce.subscription.renewed",
        "2026-10-07T12:00:00.000999Z",
      ),
      appliedAt: "2026-10-07T12:00:02Z",
      current: revoked.record,
    });

    expect(newerGrant.outcome).toBe("reactivated");
    expect(newerGrant.record.status).toBe("active");
  });

  it("reactivates only from a newer grant", () => {
    const revoked = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "revoke",
      event: event(
        "evt-refund",
        "commerce.payment.refunded",
        "2026-10-07T12:00:00Z",
      ),
      appliedAt: "2026-10-07T12:00:01Z",
    });

    const reactivated = applyEntitlementTransition({
      entitlementId: "ent-1",
      identity,
      action: "grant",
      event: event(
        "evt-renew",
        "commerce.subscription.renewed",
        "2026-10-08T12:00:00Z",
      ),
      appliedAt: "2026-10-08T12:00:01Z",
      current: revoked.record,
    });

    expect(reactivated.outcome).toBe("reactivated");
    expect(reactivated.record.status).toBe("active");
    expect(reactivated.record.version).toBe(2);
  });
});
