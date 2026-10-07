import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { applyEntitlementTransition } from "./entitlement";
import {
  commerceIdempotencyKey,
  entitlementIdentityKey,
  normalizeEntitlementIdentity,
  normalizeOptionalExternalId,
  processingIntentMatches,
  type CommerceProcessingOutcome,
  type CommerceProviderId,
  type EntitlementAction,
  type EntitlementIdentity,
  type EntitlementRecord,
  type NormalizedCommerceEvent,
  type ProviderEventRecord,
} from "./domain";

export interface ReceiveCommerceEventResult {
  record: ProviderEventRecord;
  duplicate: boolean;
}

export interface ProcessCommerceEventInput {
  event: NormalizedCommerceEvent;
  action: EntitlementAction;
  entitlement?: EntitlementIdentity;
  processedAt?: string;
}

export interface ProcessCommerceEventResult {
  event: ProviderEventRecord;
  entitlement?: EntitlementRecord;
  duplicate: boolean;
  outcome: CommerceProcessingOutcome;
}

function hashDocumentId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validTimestamp(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return value;
}

function symbolicErrorCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(normalized)) {
    throw new Error("errorCode must be a symbolic non-sensitive code");
  }
  return normalized;
}

function validCorrelationId(value: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(normalized)) {
    throw new Error("correlationId must be a safe identifier");
  }
  return normalized;
}

function eventMatches(
  record: ProviderEventRecord,
  event: NormalizedCommerceEvent,
): boolean {
  return (
    record.provider.trim() === event.provider.trim() &&
    record.externalEventId.trim() === event.externalEventId.trim() &&
    record.type === event.type &&
    Date.parse(record.occurredAt) === Date.parse(event.occurredAt) &&
    normalizeOptionalExternalId(record.customerExternalId) ===
      normalizeOptionalExternalId(event.customerExternalId) &&
    normalizeOptionalExternalId(record.productExternalId) ===
      normalizeOptionalExternalId(event.productExternalId) &&
    normalizeOptionalExternalId(record.transactionExternalId) ===
      normalizeOptionalExternalId(event.transactionExternalId)
  );
}

function assertEventMatches(
  record: ProviderEventRecord,
  event: NormalizedCommerceEvent,
) {
  if (!eventMatches(record, event)) {
    throw new Error("COMMERCE_EVENT_CONFLICT");
  }
}

export class FirestoreCommerceLedger {
  constructor(private readonly firestore: Firestore) {}

  private eventRef(
    event: Pick<NormalizedCommerceEvent, "provider" | "externalEventId">,
  ) {
    return this.firestore
      .collection("commerceProviderEvents")
      .doc(hashDocumentId(commerceIdempotencyKey(event)));
  }

  private entitlementRef(identity: EntitlementIdentity) {
    const normalized = normalizeEntitlementIdentity(identity);
    const tenantRef = this.firestore
      .collection("commerceTenants")
      .doc(hashDocumentId(normalized.tenantId));

    return tenantRef
      .collection("entitlements")
      .doc(hashDocumentId(entitlementIdentityKey(normalized)));
  }

  async getEvent(
    event: Pick<NormalizedCommerceEvent, "provider" | "externalEventId">,
  ): Promise<ProviderEventRecord | undefined> {
    const snapshot = await this.eventRef(event).get();
    return snapshot.exists
      ? (snapshot.data() as ProviderEventRecord)
      : undefined;
  }

  async getEntitlement(
    identity: EntitlementIdentity,
  ): Promise<EntitlementRecord | undefined> {
    const snapshot = await this.entitlementRef(identity).get();
    return snapshot.exists
      ? (snapshot.data() as EntitlementRecord)
      : undefined;
  }

  async receive(
    event: NormalizedCommerceEvent,
    correlationId: string,
    receivedAt = new Date().toISOString(),
  ): Promise<ReceiveCommerceEventResult> {
    validTimestamp(event.occurredAt, "event.occurredAt");
    validTimestamp(receivedAt, "receivedAt");

    const normalizedCorrelationId = validCorrelationId(correlationId);
    const normalizedCustomerExternalId = normalizeOptionalExternalId(
      event.customerExternalId,
    );
    const normalizedProductExternalId = normalizeOptionalExternalId(
      event.productExternalId,
    );
    const normalizedTransactionExternalId = normalizeOptionalExternalId(
      event.transactionExternalId,
    );
    const eventRef = this.eventRef(event);

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventRef);

      if (snapshot.exists) {
        const current = snapshot.data() as ProviderEventRecord;
        assertEventMatches(current, event);
        return { record: current, duplicate: true };
      }

      const record: ProviderEventRecord = {
        idempotencyKey: commerceIdempotencyKey(event),
        provider: event.provider.trim() as CommerceProviderId,
        externalEventId: event.externalEventId.trim(),
        type: event.type,
        occurredAt: event.occurredAt,
        ...(normalizedCustomerExternalId !== undefined
          ? { customerExternalId: normalizedCustomerExternalId }
          : {}),
        ...(normalizedProductExternalId !== undefined
          ? { productExternalId: normalizedProductExternalId }
          : {}),
        ...(normalizedTransactionExternalId !== undefined
          ? { transactionExternalId: normalizedTransactionExternalId }
          : {}),
        correlationId: normalizedCorrelationId,
        receivedAt,
        processingStatus: "received",
        processingAttempts: 0,
      };

      transaction.set(eventRef, record);
      return { record, duplicate: false };
    });
  }

  async process(
    input: ProcessCommerceEventInput,
  ): Promise<ProcessCommerceEventResult> {
    const processedAt = validTimestamp(
      input.processedAt ?? new Date().toISOString(),
      "processedAt",
    );
    validTimestamp(input.event.occurredAt, "event.occurredAt");

    if (input.action !== "none" && !input.entitlement) {
      throw new Error("ENTITLEMENT_IDENTITY_REQUIRED");
    }

    const identity = input.entitlement
      ? normalizeEntitlementIdentity(input.entitlement)
      : undefined;
    const eventRef = this.eventRef(input.event);
    const entitlementRef = identity
      ? this.entitlementRef(identity)
      : undefined;

    return this.firestore.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventRef);
      if (!eventSnapshot.exists) {
        throw new Error("COMMERCE_EVENT_NOT_RECEIVED");
      }

      const currentEvent = eventSnapshot.data() as ProviderEventRecord;
      assertEventMatches(currentEvent, input.event);

      if (currentEvent.processingStatus === "processed") {
        if (
          !processingIntentMatches(
            currentEvent,
            input.action,
            identity,
          )
        ) {
          throw new Error("COMMERCE_EVENT_RESOLUTION_CONFLICT");
        }

        if (input.action === "none") {
          return {
            event: currentEvent,
            duplicate: true,
            outcome:
              currentEvent.outcome ??
              "no_entitlement_change",
          };
        }

        const entitlementSnapshot = await transaction.get(
          entitlementRef!,
        );
        const currentEntitlement = entitlementSnapshot.exists
          ? (entitlementSnapshot.data() as EntitlementRecord)
          : undefined;

        return {
          event: currentEvent,
          ...(currentEntitlement
            ? { entitlement: currentEntitlement }
            : {}),
          duplicate: true,
          outcome:
            currentEvent.outcome ??
            "no_entitlement_change",
        };
      }

      if (input.action === "none") {
        const processedEvent: ProviderEventRecord = {
          ...currentEvent,
          processingStatus: "processed",
          processingAttempts:
            currentEvent.processingAttempts + 1,
          processedAt,
          outcome: "no_entitlement_change",
        };
        transaction.set(eventRef, processedEvent);

        return {
          event: processedEvent,
          duplicate: false,
          outcome: "no_entitlement_change",
        };
      }

      const entitlementSnapshot = await transaction.get(
        entitlementRef!,
      );
      const currentEntitlement = entitlementSnapshot.exists
        ? (entitlementSnapshot.data() as EntitlementRecord)
        : undefined;

      const entitlementId = hashDocumentId(
        entitlementIdentityKey(identity!),
      );

      const transition = applyEntitlementTransition({
        entitlementId,
        identity: identity!,
        action: input.action,
        event: input.event,
        appliedAt: processedAt,
        current: currentEntitlement,
      });

      if (transition.changed) {
        transaction.set(
          entitlementRef!,
          transition.record,
        );
      }

      const processedEvent: ProviderEventRecord = {
        ...currentEvent,
        processingStatus: "processed",
        processingAttempts:
          currentEvent.processingAttempts + 1,
        processedAt,
        outcome: transition.outcome,
        resolution: {
          ...identity!,
          entitlementId,
          action: input.action,
        },
      };
      transaction.set(eventRef, processedEvent);

      return {
        event: processedEvent,
        entitlement: transition.record,
        duplicate: false,
        outcome: transition.outcome,
      };
    });
  }

  async markFailed(
    event: NormalizedCommerceEvent,
    errorCode: string,
    failedAt = new Date().toISOString(),
  ): Promise<ProviderEventRecord> {
    validTimestamp(failedAt, "failedAt");
    const eventRef = this.eventRef(event);

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(eventRef);
      if (!snapshot.exists) {
        throw new Error("COMMERCE_EVENT_NOT_RECEIVED");
      }

      const current = snapshot.data() as ProviderEventRecord;
      assertEventMatches(current, event);

      if (current.processingStatus === "processed") {
        return current;
      }

      const failed: ProviderEventRecord = {
        ...current,
        processingStatus: "failed",
        processingAttempts:
          current.processingAttempts + 1,
        failedAt,
        lastErrorCode: symbolicErrorCode(errorCode),
      };

      transaction.set(eventRef, failed);
      return failed;
    });
  }
}
