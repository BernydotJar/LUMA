import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreCommerceLedger } from "./ledger";
import type { NormalizedCommerceEvent } from "./domain";

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const app = emulatorEnabled
  ? initializeApp(
      {
        projectId:
          process.env.GCLOUD_PROJECT ||
          "demo-luma-commerce",
      },
      `luma-commerce-ledger-${randomUUID()}`,
    )
  : undefined;

const ledger = app
  ? new FirestoreCommerceLedger(getFirestore(app))
  : undefined;

function payment(
  externalEventId: string,
  occurredAt: string,
): NormalizedCommerceEvent {
  return {
    provider: "stripe",
    externalEventId,
    type: "commerce.payment.confirmed",
    occurredAt,
    customerExternalId: "cus-1",
    productExternalId: "program-1",
  };
}

describe.runIf(emulatorEnabled)(
  "FirestoreCommerceLedger emulator",
  () => {
    afterAll(async () => {
      if (app) await deleteApp(app);
    });

    it("records, processes and replays a payment exactly once", async () => {
      const suffix = randomUUID();
      const event = payment(
        `evt-${suffix}`,
        "2026-10-07T12:00:00Z",
      );
      const identity = {
        tenantId: `tenant-${suffix}`,
        customerId: "customer-1",
        productId: "program-1",
      };

      const firstReceive = await ledger!.receive(
        event,
        `corr-${suffix}`,
        "2026-10-07T12:00:01Z",
      );
      const duplicateReceive = await ledger!.receive(
        event,
        `corr-retry-${suffix}`,
        "2026-10-07T12:00:02Z",
      );
      const firstProcess = await ledger!.process({
        event,
        action: "grant",
        entitlement: identity,
        processedAt: "2026-10-07T12:00:03Z",
      });
      const replay = await ledger!.process({
        event,
        action: "grant",
        entitlement: identity,
        processedAt: "2026-10-07T12:00:04Z",
      });

      expect(firstReceive.duplicate).toBe(false);
      expect(duplicateReceive.duplicate).toBe(true);
      expect(firstProcess.duplicate).toBe(false);
      expect(firstProcess.outcome).toBe("granted");
      expect(firstProcess.entitlement?.version).toBe(1);
      expect(replay.duplicate).toBe(true);
      expect(replay.entitlement?.version).toBe(1);
    });

    it("rejects a changed payload replay that reuses a provider event id", async () => {
      const suffix = randomUUID();
      const event = payment(
        `evt-conflict-${suffix}`,
        "2026-10-07T12:00:00Z",
      );

      await ledger!.receive(
        event,
        `corr-${suffix}`,
        "2026-10-07T12:00:01Z",
      );

      await expect(
        ledger!.receive(
          {
            ...event,
            type: "commerce.payment.refunded",
          },
          `corr-conflict-${suffix}`,
          "2026-10-07T12:00:02Z",
        ),
      ).rejects.toThrow("COMMERCE_EVENT_CONFLICT");
    });

    it("preserves revocation when events arrive out of order", async () => {
      const suffix = randomUUID();
      const identity = {
        tenantId: `tenant-${suffix}`,
        customerId: "customer-1",
        productId: "program-1",
      };
      const refund: NormalizedCommerceEvent = {
        provider: "stripe",
        externalEventId: `evt-refund-${suffix}`,
        type: "commerce.payment.refunded",
        occurredAt: "2026-10-07T12:10:00Z",
      };
      const delayedPayment = payment(
        `evt-payment-${suffix}`,
        "2026-10-07T12:00:00Z",
      );

      await ledger!.receive(
        refund,
        `corr-refund-${suffix}`,
        "2026-10-07T12:10:01Z",
      );
      const revoked = await ledger!.process({
        event: refund,
        action: "revoke",
        entitlement: identity,
        processedAt: "2026-10-07T12:10:02Z",
      });

      await ledger!.receive(
        delayedPayment,
        `corr-payment-${suffix}`,
        "2026-10-07T12:11:00Z",
      );
      const stale = await ledger!.process({
        event: delayedPayment,
        action: "grant",
        entitlement: identity,
        processedAt: "2026-10-07T12:11:01Z",
      });

      expect(revoked.entitlement?.status).toBe("revoked");
      expect(stale.outcome).toBe("ignored_stale");
      expect(stale.entitlement?.status).toBe("revoked");
    });

    it("keeps the same customer/product isolated across tenants", async () => {
      const suffix = randomUUID();
      const eventA = payment(
        `evt-a-${suffix}`,
        "2026-10-07T12:00:00Z",
      );
      const eventB = payment(
        `evt-b-${suffix}`,
        "2026-10-07T12:00:01Z",
      );
      const a = {
        tenantId: `tenant-a-${suffix}`,
        customerId: "customer-1",
        productId: "program-1",
      };
      const b = {
        tenantId: `tenant-b-${suffix}`,
        customerId: "customer-1",
        productId: "program-1",
      };

      await ledger!.receive(eventA, `corr-a-${suffix}`);
      await ledger!.receive(eventB, `corr-b-${suffix}`);
      await ledger!.process({
        event: eventA,
        action: "grant",
        entitlement: a,
      });
      await ledger!.process({
        event: eventB,
        action: "grant",
        entitlement: b,
      });

      const [entitlementA, entitlementB] = await Promise.all([
        ledger!.getEntitlement(a),
        ledger!.getEntitlement(b),
      ]);

      expect(entitlementA?.tenantId).toBe(a.tenantId);
      expect(entitlementB?.tenantId).toBe(b.tenantId);
      expect(entitlementA?.entitlementId).not.toBe(
        entitlementB?.entitlementId,
      );
    });

    it("allows a failed event to be retried without creating a second entitlement", async () => {
      const suffix = randomUUID();
      const event = payment(
        `evt-retry-${suffix}`,
        "2026-10-07T12:00:00Z",
      );
      const identity = {
        tenantId: `tenant-${suffix}`,
        customerId: "customer-1",
        productId: "program-1",
      };

      await ledger!.receive(
        event,
        `corr-${suffix}`,
        "2026-10-07T12:00:01Z",
      );

      const failed = await ledger!.markFailed(
        event,
        "PRODUCT_MAPPING_UNAVAILABLE",
        "2026-10-07T12:00:02Z",
      );
      const processed = await ledger!.process({
        event,
        action: "grant",
        entitlement: identity,
        processedAt: "2026-10-07T12:00:03Z",
      });

      expect(failed.processingStatus).toBe("failed");
      expect(failed.lastErrorCode).toBe(
        "PRODUCT_MAPPING_UNAVAILABLE",
      );
      expect(processed.event.processingAttempts).toBe(2);
      expect(processed.entitlement?.version).toBe(1);
    });
    it("rejects a processed replay resolved to a different tenant", async () => {
      const suffix = randomUUID();
      const event = payment(
        `evt-tenant-replay-${suffix}`,
        "2026-10-07T12:00:00Z",
      );
      const original = {
        tenantId: `tenant-a-${suffix}`,
        customerId: "customer-1",
        productId: "program-1",
      };
      const wrongTenant = {
        ...original,
        tenantId: `tenant-b-${suffix}`,
      };

      await ledger!.receive(event, `corr-${suffix}`);
      await ledger!.process({
        event,
        action: "grant",
        entitlement: original,
      });

      await expect(
        ledger!.process({
          event,
          action: "grant",
          entitlement: wrongTenant,
        }),
      ).rejects.toThrow("COMMERCE_EVENT_RESOLUTION_CONFLICT");

      expect(
        (await ledger!.getEntitlement(original))?.status,
      ).toBe("active");
      expect(
        await ledger!.getEntitlement(wrongTenant),
      ).toBeUndefined();
    });

    it("normalizes empty optional provider ids without making the event unprocessable", async () => {
      const suffix = randomUUID();
      const event: NormalizedCommerceEvent = {
        provider: "stripe",
        externalEventId: `evt-empty-optional-${suffix}`,
        type: "commerce.payment.confirmed",
        occurredAt: "2026-10-07T12:00:00Z",
        customerExternalId: "   ",
        productExternalId: "",
        transactionExternalId: "  ",
      };
      const identity = {
        tenantId: `tenant-empty-${suffix}`,
        customerId: "customer-1",
        productId: "program-1",
      };

      const received = await ledger!.receive(
        event,
        `corr-empty-${suffix}`,
      );
      const processed = await ledger!.process({
        event,
        action: "grant",
        entitlement: identity,
      });

      expect(received.record.customerExternalId).toBeUndefined();
      expect(received.record.productExternalId).toBeUndefined();
      expect(received.record.transactionExternalId).toBeUndefined();
      expect(processed.outcome).toBe("granted");
      expect(processed.entitlement?.status).toBe("active");
    });

  },
);
