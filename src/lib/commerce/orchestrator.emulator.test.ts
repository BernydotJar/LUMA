import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreCommerceEnrollmentStore, isActiveCommerceEnrollment } from "./enrollment";
import { FirestoreCommerceProviderBindingStore } from "./binding";
import { FirestoreCommerceLedger } from "./ledger";
import { FirestoreCommerceProductMappingStore } from "./mapping";
import { CommerceEnrollmentOrchestrator } from "./orchestrator";
import type { NormalizedCommerceEvent } from "./domain";

const emulatorEnabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const app = emulatorEnabled
  ? initializeApp(
      {
        projectId:
          process.env.GCLOUD_PROJECT ||
          "demo-luma-commerce-orchestration",
      },
      `luma-commerce-orchestration-${randomUUID()}`,
    )
  : undefined;

const firestore = app ? getFirestore(app) : undefined;
const ledger = firestore
  ? new FirestoreCommerceLedger(firestore)
  : undefined;
const mappings = firestore
  ? new FirestoreCommerceProductMappingStore(firestore)
  : undefined;
const enrollments = firestore
  ? new FirestoreCommerceEnrollmentStore(firestore)
  : undefined;
const bindings = firestore
  ? new FirestoreCommerceProviderBindingStore(firestore)
  : undefined;
const orchestrator =
  ledger && mappings && enrollments && bindings
    ? new CommerceEnrollmentOrchestrator(
        ledger,
        mappings,
        enrollments,
        bindings,
      )
    : undefined;

function event(
  suffix: string,
  overrides: Partial<NormalizedCommerceEvent> = {},
): NormalizedCommerceEvent {
  return {
    provider: "hotmart",
    externalEventId: `evt-${suffix}`,
    type: "commerce.payment.confirmed",
    occurredAt: "2026-10-08T12:00:00Z",
    customerExternalId: `buyer-${suffix}`,
    productExternalId: `external-program-${suffix}`,
    transactionExternalId: `tx-${suffix}`,
    metadata: {
      buyerEmail: `learner-${suffix}@example.com`,
    },
    ...overrides,
  };
}

describe.runIf(emulatorEnabled)(
  "CommerceEnrollmentOrchestrator emulator",
  () => {
    afterAll(async () => {
      if (app) await deleteApp(app);
    });

    it("activates access after payment and lets the matching verified identity claim it", async () => {
      const suffix = randomUUID();
      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffix}`,
        tenantId: "seres-de-excelencia",
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });

      const commerceEvent = event(suffix);
      const first = await orchestrator!.handle(
        commerceEvent,
        `corr-${suffix}`,
      );
      const replay = await orchestrator!.handle(
        commerceEvent,
        `corr-replay-${suffix}`,
      );

      expect(first).toMatchObject({
        status: "processed",
        duplicate: false,
        outcome: "granted",
        enrollment: {
          status: "active",
          tenantId: "seres-de-excelencia",
          programId: "pnl-practitioner",
        },
      });
      expect(replay.duplicate).toBe(true);

      const claimed = await enrollments!.claimByEmail(
        `firebase-${suffix}`,
        `LEARNER-${suffix}@EXAMPLE.COM`,
      );
      expect(claimed).toHaveLength(1);
      expect(claimed[0]).toMatchObject({
        learnerId: `firebase-${suffix}`,
        status: "active",
      });

      const byLearner = await enrollments!.listByLearner(
        `firebase-${suffix}`,
      );
      expect(byLearner).toHaveLength(1);
    });

    it("revokes the enrollment when a later refund arrives", async () => {
      const suffix = randomUUID();
      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffix}`,
        tenantId: "seres-de-excelencia",
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });

      const payment = event(suffix);
      await orchestrator!.handle(
        payment,
        `corr-payment-${suffix}`,
      );

      const refund = event(suffix, {
        externalEventId: `refund-${suffix}`,
        type: "commerce.payment.refunded",
        occurredAt: "2026-10-08T12:10:00Z",
      });
      const result = await orchestrator!.handle(
        refund,
        `corr-refund-${suffix}`,
      );

      expect(result).toMatchObject({
        status: "processed",
        outcome: "revoked",
        enrollment: { status: "revoked" },
      });

      const claimed = await enrollments!.claimByEmail(
        `firebase-${suffix}`,
        `learner-${suffix}@example.com`,
      );
      expect(claimed).toHaveLength(0);
    });

    it("revokes from the durable transaction binding when a refund omits product and customer", async () => {
      const suffix = randomUUID();
      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffix}`,
        tenantId: "seres-de-excelencia",
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });

      const payment = event(suffix);
      await orchestrator!.handle(payment, `corr-payment-${suffix}`);

      const refund = event(suffix, {
        externalEventId: `refund-binding-${suffix}`,
        type: "commerce.payment.refunded",
        occurredAt: "2026-10-08T12:10:00Z",
        productExternalId: undefined,
        customerExternalId: undefined,
        metadata: {},
      });
      const result = await orchestrator!.handle(
        refund,
        `corr-refund-${suffix}`,
      );

      expect(result).toMatchObject({
        status: "processed",
        outcome: "revoked",
        enrollment: { status: "revoked" },
      });
    });

    it("keeps paid subscription access active until the scheduled Hotmart cutoff", async () => {
      const suffix = randomUUID();
      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffix}`,
        tenantId: "seres-de-excelencia",
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });

      const subscriptionId = `sub-${suffix}`;
      const purchase = event(suffix, {
        type: "commerce.subscription.created",
        customerExternalId: subscriptionId,
        transactionExternalId: subscriptionId,
        occurredAt: "2026-10-08T12:00:00Z",
      });
      await orchestrator!.handle(purchase, `corr-sub-${suffix}`);

      const cancellation = event(suffix, {
        externalEventId: `cancel-${suffix}`,
        type: "commerce.subscription.cancellation_scheduled",
        occurredAt: "2026-10-08T12:10:00Z",
        customerExternalId: undefined,
        productExternalId: undefined,
        transactionExternalId: subscriptionId,
        metadata: { accessEndsAt: "2026-10-20T12:00:00Z" },
      });
      const result = await orchestrator!.handle(
        cancellation,
        `corr-cancel-${suffix}`,
      );

      expect(result).toMatchObject({
        status: "processed",
        outcome: "no_entitlement_change",
        enrollment: {
          status: "active",
          accessEndsAt: "2026-10-20T12:00:00Z",
        },
      });
      expect(
        isActiveCommerceEnrollment(
          result.enrollment!,
          "2026-10-19T12:00:00Z",
        ),
      ).toBe(true);
      expect(
        isActiveCommerceEnrollment(
          result.enrollment!,
          "2026-10-21T12:00:00Z",
        ),
      ).toBe(false);
    });

    it("keeps paid Hotmart subscription access until its billing-period deadline", async () => {
      const suffix = randomUUID();
      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffix}`,
        tenantId: "seres-de-excelencia",
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });
      await orchestrator!.handle(event(suffix, {
        type: "commerce.subscription.created",
      }), `corr-sub-${suffix}`);
      const cancelled = event(suffix, {
        externalEventId: `cancel-${suffix}`,
        type: "commerce.subscription.cancellation_scheduled",
        occurredAt: "2026-10-08T12:10:00Z",
        metadata: { accessEndsAt: "2026-10-10T12:10:00Z" },
      });
      const scheduled = await orchestrator!.handle(cancelled, `corr-cancel-${suffix}`);
      expect(scheduled.outcome).toBe("no_entitlement_change");
      expect(scheduled.enrollment?.status).toBe("active");
      expect(scheduled.enrollment?.accessEndsAt).toBe("2026-10-10T12:10:00Z");
      expect(isActiveCommerceEnrollment(scheduled.enrollment!, "2026-10-09T00:00:00Z")).toBe(true);
      expect(isActiveCommerceEnrollment(scheduled.enrollment!, "2026-10-11T00:00:00Z")).toBe(false);

      const renewed = await orchestrator!.handle(event(suffix, {
        externalEventId: `renew-${suffix}`,
        type: "commerce.subscription.renewed",
        occurredAt: "2026-10-11T12:00:00Z",
      }), `corr-renew-${suffix}`);
      expect(renewed.enrollment?.accessEndsAt).toBeUndefined();
      expect(isActiveCommerceEnrollment(renewed.enrollment!, "2026-10-12T00:00:00Z")).toBe(true);
    });

    it("keeps an incomplete Stripe subscription unentitled until its paid invoice arrives", async () => {
      const suffix = randomUUID();
      const customerId = `stripe-customer-${suffix}`;
      const subscriptionId = `stripe-sub-${suffix}`;
      const productId = `product-${suffix}`;
      const tenantId = `tenant-${suffix}`;
      const externalProductId = `external-stripe-${suffix}`;
      await mappings!.upsert({ provider: "stripe", externalProductId, tenantId,
        productId, programId: `program-${suffix}` });
      const pending = event(suffix, { provider: "stripe", externalEventId: `pending-${suffix}`,
        type: "commerce.subscription.pending", customerExternalId: customerId,
        transactionExternalId: subscriptionId, productExternalId: externalProductId });
      const before = await orchestrator!.handle(pending, `corr-pending-${suffix}`);
      expect(before.outcome).toBe("no_entitlement_change");
      expect(await ledger!.getEntitlement({ tenantId, customerId, productId })).toBeUndefined();
      const paid = event(suffix, { provider: "stripe", externalEventId: `invoice-paid-${suffix}`,
        type: "commerce.subscription.renewed", occurredAt: "2026-10-08T12:20:00Z",
        customerExternalId: undefined, productExternalId: undefined,
        transactionExternalId: subscriptionId, metadata: {} });
      const activated = await orchestrator!.handle(paid, `corr-paid-${suffix}`);
      expect(activated.outcome).toBe("granted");
      expect(activated.enrollment?.status).toBe("active");
      expect(activated.enrollment?.email).toBe(`learner-${suffix}@example.com`);
    });

    it("keeps a second product entitlement active when the first product is refunded", async () => {
      const suffix = randomUUID();
      const tenantId = `tenant-two-products-${suffix}`;
      const programId = `program-two-products-${suffix}`;
      for (const product of ["a", "b"]) {
        await mappings!.upsert({ provider: "hotmart", externalProductId: `external-${product}-${suffix}`,
          tenantId, productId: `product-${product}`, programId,
          offeringId: `offering-${product}` });
      }
      const a = event(suffix, { externalEventId: `purchase-a-${suffix}`,
        productExternalId: `external-a-${suffix}`, transactionExternalId: `tx-a-${suffix}` });
      const b = event(suffix, { externalEventId: `purchase-b-${suffix}`,
        productExternalId: `external-b-${suffix}`, transactionExternalId: `tx-b-${suffix}` });
      const purchaseA = await orchestrator!.handle(a, `corr-a-${suffix}`);
      const purchaseB = await orchestrator!.handle(b, `corr-b-${suffix}`);
      expect(purchaseA.enrollment?.enrollmentId).not.toBe(purchaseB.enrollment?.enrollmentId);
      expect(purchaseA.enrollment?.offeringId).toBe("offering-a");
      expect(purchaseB.enrollment?.offeringId).toBe("offering-b");
      const claimed = await enrollments!.claimByEmail(`firebase-${suffix}`,
        `learner-${suffix}@example.com`);
      expect(claimed).toHaveLength(2);
      const refundA = event(suffix, { externalEventId: `refund-a-${suffix}`,
        productExternalId: `external-a-${suffix}`, transactionExternalId: `tx-a-${suffix}`,
        type: "commerce.payment.refunded", occurredAt: "2026-10-08T12:15:00Z" });
      await orchestrator!.handle(refundA, `corr-refund-a-${suffix}`);
      const persisted = await enrollments!.listByLearner(`firebase-${suffix}`);
      expect(persisted).toHaveLength(2);
      expect(persisted.find((item) => item.productId === "product-a")?.status).toBe("revoked");
      expect(persisted.find((item) => item.productId === "product-b")?.status).toBe("active");
      expect(persisted.find((item) => item.productId === "product-b")?.offeringId).toBe("offering-b");
    });

    it("durably retains an event when product mapping is not ready", async () => {
      const suffix = randomUUID();
      const commerceEvent = event(suffix);

      const result = await orchestrator!.handle(
        commerceEvent,
        `corr-${suffix}`,
      );
      const stored = await ledger!.getEvent(commerceEvent);

      expect(result.status).toBe("pending_mapping");
      expect(stored).toMatchObject({
        processingStatus: "failed",
        lastErrorCode: "PRODUCT_MAPPING_UNAVAILABLE",
      });
    });

    it("processes non-entitling payment failures without a product mapping", async () => {
      const suffix = randomUUID();
      const commerceEvent = event(suffix, {
        type: "commerce.payment.failed",
      });

      const result = await orchestrator!.handle(
        commerceEvent,
        `corr-${suffix}`,
      );

      expect(result).toMatchObject({
        status: "processed",
        outcome: "no_entitlement_change",
      });
    });

    it("scopes active learner ids by tenant for coach authorization", async () => {
      const suffixA = randomUUID();
      const suffixB = randomUUID();

      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffixA}`,
        tenantId: `tenant-a-${suffixA}`,
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });
      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffixB}`,
        tenantId: `tenant-b-${suffixB}`,
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });

      await orchestrator!.handle(event(suffixA), `corr-${suffixA}`);
      await orchestrator!.handle(event(suffixB), `corr-${suffixB}`);
      await enrollments!.claimByEmail(
        `learner-a-${suffixA}`,
        `learner-${suffixA}@example.com`,
      );
      await enrollments!.claimByEmail(
        `learner-b-${suffixB}`,
        `learner-${suffixB}@example.com`,
      );

      const tenantA = await enrollments!.listActiveLearnerIdsByTenants([
        `tenant-a-${suffixA}`,
      ]);
      expect(tenantA).toContain(`learner-a-${suffixA}`);
      expect(tenantA).not.toContain(`learner-b-${suffixB}`);
      expect(
        await enrollments!.learnerHasActiveTenantAccess(
          `learner-a-${suffixA}`,
          [`tenant-a-${suffixA}`],
        ),
      ).toBe(true);
      expect(
        await enrollments!.learnerHasActiveTenantAccess(
          `learner-a-${suffixA}`,
          [`tenant-b-${suffixB}`],
        ),
      ).toBe(false);
    });

    it("keeps a newer revocation when an older payment arrives late", async () => {
      const suffix = randomUUID();
      await mappings!.upsert({
        provider: "hotmart",
        externalProductId: `external-program-${suffix}`,
        tenantId: "seres-de-excelencia",
        productId: "pnl-practitioner",
        programId: "pnl-practitioner",
      });

      const refund = event(suffix, {
        externalEventId: `refund-first-${suffix}`,
        type: "commerce.payment.refunded",
        occurredAt: "2026-10-08T12:10:00Z",
      });
      const delayedPayment = event(suffix, {
        externalEventId: `payment-late-${suffix}`,
        occurredAt: "2026-10-08T12:00:00Z",
      });

      await orchestrator!.handle(
        refund,
        `corr-refund-${suffix}`,
      );
      const stale = await orchestrator!.handle(
        delayedPayment,
        `corr-late-${suffix}`,
      );

      expect(stale.outcome).toBe("ignored_stale");
      expect(stale.enrollment?.status).toBe("revoked");
    });
  },
);
