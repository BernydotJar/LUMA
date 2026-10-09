import { randomUUID } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { FirestoreCommerceEnrollmentStore } from "./enrollment";
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
