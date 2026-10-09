import { createHash } from "node:crypto";
import type {
  CommerceProcessingOutcome,
  NormalizedCommerceEvent,
  EntitlementIdentity,
} from "./domain";
import { entitlementIdentityKey } from "./domain";
import type { FirestoreCommerceLedger } from "./ledger";
import type { CommerceProductMappingStore } from "./mapping";
import type { FirestoreCommerceProviderBindingStore } from "./binding";
import type {
  CommerceEnrollmentRecord,
  FirestoreCommerceEnrollmentStore,
} from "./enrollment";
import { entitlementActionForCommerceEvent } from "./policy";

export type CommerceOrchestrationStatus =
  | "processed"
  | "pending_mapping"
  | "pending_customer";

export interface CommerceOrchestrationResult {
  status: CommerceOrchestrationStatus;
  duplicate: boolean;
  outcome?: CommerceProcessingOutcome;
  enrollment?: CommerceEnrollmentRecord;
}

export class CommerceEnrollmentOrchestrator {
  constructor(
    private readonly ledger: FirestoreCommerceLedger,
    private readonly mappings: CommerceProductMappingStore,
    private readonly enrollments: FirestoreCommerceEnrollmentStore,
    private readonly bindings: FirestoreCommerceProviderBindingStore,
  ) {}

  async handle(
    event: NormalizedCommerceEvent,
    correlationId: string,
  ): Promise<CommerceOrchestrationResult> {
    const received = await this.ledger.receive(event, correlationId);
    const action = entitlementActionForCommerceEvent(event);

    if (event.type === "commerce.subscription.pending") {
      const externalProductId = event.productExternalId?.trim();
      const transactionId = event.transactionExternalId?.trim();
      const customerId = event.customerExternalId?.trim();
      const mapping = externalProductId
        ? await this.mappings.resolve(event.provider, externalProductId)
        : undefined;
      if (!mapping || !transactionId) {
        await this.ledger.markFailed(event, "PRODUCT_MAPPING_UNAVAILABLE");
        return { status: "pending_mapping", duplicate: received.duplicate };
      }
      if (!customerId) {
        await this.ledger.markFailed(event, "CUSTOMER_ID_UNAVAILABLE");
        return { status: "pending_customer", duplicate: received.duplicate };
      }
      const identity: EntitlementIdentity = { tenantId: mapping.tenantId, customerId,
        productId: mapping.productId };
      await this.bindings.upsert({
        provider: event.provider, transactionExternalId: transactionId,
        mapping, customerId, email: event.metadata?.buyerEmail,
        entitlementId: createHash("sha256").update(entitlementIdentityKey(identity)).digest("hex"),
      });
      const processed = await this.ledger.process({ event, action: "none" });
      return { status: "processed", duplicate: received.duplicate || processed.duplicate,
        outcome: processed.outcome };
    }

    if (action === "none" && event.type !== "commerce.subscription.cancellation_scheduled") {
      const processed = await this.ledger.process({ event, action });
      return {
        status: "processed",
        duplicate: received.duplicate || processed.duplicate,
        outcome: processed.outcome,
      };
    }

    const transactionExternalId = event.transactionExternalId?.trim();
    const binding = transactionExternalId
      ? await this.bindings.get(event.provider, transactionExternalId)
      : undefined;

    const externalProductId = event.productExternalId?.trim();
    const directMapping = externalProductId
      ? await this.mappings.resolve(event.provider, externalProductId)
      : undefined;

    const mapping = binding
      ? {
          tenantId: binding.tenantId,
          productId: binding.productId,
          programId: binding.programId,
          ...(binding.offeringId ? { offeringId: binding.offeringId } : {}),
        }
      : directMapping;

    if (!mapping) {
      await this.ledger.markFailed(event, "PRODUCT_MAPPING_UNAVAILABLE");
      return {
        status: "pending_mapping",
        duplicate: received.duplicate,
      };
    }

    const customerId =
      binding?.customerId ?? event.customerExternalId?.trim();
    if (!customerId) {
      await this.ledger.markFailed(event, "CUSTOMER_ID_UNAVAILABLE");
      return {
        status: "pending_customer",
        duplicate: received.duplicate,
      };
    }

    if (event.type === "commerce.subscription.cancellation_scheduled") {
      const accessEndsAt = event.metadata?.accessEndsAt;
      if (!accessEndsAt) throw new Error("COMMERCE_ACCESS_END_REQUIRED");
      const enrollment = await this.enrollments.scheduleExpiry({
        mapping, customerId, event, accessEndsAt,
      });
      const processed = await this.ledger.process({ event, action: "none" });
      return {
        status: "processed",
        duplicate: received.duplicate || processed.duplicate,
        outcome: processed.outcome,
        enrollment,
      };
    }

    const processed = await this.ledger.process({
      event,
      action,
      entitlement: {
        tenantId: mapping.tenantId,
        customerId,
        productId: mapping.productId,
      },
    });

    if (!processed.entitlement) {
      throw new Error("ENTITLEMENT_RESULT_REQUIRED");
    }

    const buyerEmail = event.metadata?.buyerEmail ?? binding?.email;
    const enrollment = await this.enrollments.apply({
      mapping,
      entitlement: processed.entitlement,
      event,
      email: buyerEmail,
    });

    if (transactionExternalId) {
      await this.bindings.upsert({
        provider: event.provider,
        transactionExternalId,
        mapping,
        customerId,
        email: buyerEmail,
        entitlementId: processed.entitlement.entitlementId,
      });
    }

    return {
      status: "processed",
      duplicate:
        received.duplicate ||
        processed.duplicate ||
        enrollment.duplicate,
      outcome: processed.outcome,
      enrollment: enrollment.record,
    };
  }
}
