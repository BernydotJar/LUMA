import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { applyEntitlementTransition } from "./entitlement";
import {
  commerceIdempotencyKey,
  entitlementIdentityKey,
  type CommerceProcessingOutcome,
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

function sanitizedErrorCode(value: string): string {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_:.-]/g, "_")
    .slice(0, 120);
  if (!normalized) throw new Error("errorCode is required");
  return normalized;
}

function eventMatches(record: ProviderEventRecord, event: NormalizedCommerceEvent): boolean {
  return (
    record.provider === event.provider &&
    record.externalEventId === event.externalEventId &&
    record.type === event.type &&
    record.occurredAt === event.occurredAt &&
    record.customerExternalId === event.customerExternalId &&
    record.productExternalId === event.productExternalId &&
    record.transactionExternalId === event.transactionExternalId
  );
}

function assertEventMatches(record: ProviderEventRecord, event: NormalizedCommerceEvent) {
  if (!eventMatches(record, event)) throw new Error("COMMERCE_EVENT_CONFLICT");
}

export class FirestoreCommerceLedger {
  constructor(private readonly firestore: Firestore) {}

  private eventRef(event: Pick<NormalizedCommerceEvent, "provider" | "externalEventId">) {
    return this.firestore
      .collection("commerceProviderEvents")
      .doc(hashDocumentId(commerceIdempotencyKey(event)));
  }

  private entitlementRef(identity: EntitlementIdentity) {
    const tenantRef = this.firestore
      .collection("commerceTenants")
      .doc(hashDocumentId(identity.tenantId.trim()));

    return tenantRef
      .collection("entitlements")
      .doc(hashDocumentId(entitlementIdentityKey(identity)));
  }

  async getEvent(
    event: Pick<NormalizedCommerceEvent, "provider" | "externalEventId">,
  ): Promise<ProviderEventRecord | undefined> {
    const snapshot = await this.eventRef(event).get();
    return snapshot.exists ? (snapshot.data() as ProviderEventRecord) : undefined;
  }

  async getEntitlement(identity: EntitlementIdentity): Promise<EntitlementRecord | undefined> {
    const snapshot = await this.entitlementRef(identity).get();
    return snapshot.exists ? (snapshot.data() as EntitlementRecord) : undefined;
  }

  async receive(
    event: NormalizedCommerceEvent,
    correlationId: string,
    receivedAt = new Date().toISOString(),
  ): Promise<ReceiveCommerceEventResult> {
    validTimestamp(event.occurredAt, "event.occurredAt");
    validTimestamp(receivedAt, "receivedAt");

    const normalizedCorrelationId = correlationId.trim();
    if (!normalizedCorrelationId) throw new Error("correlationId is required");

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
        provider: event.provider,
        externalEventId: event.externalEventId,
        type: event.type,
        occurredAt: event.occurredAt,
        ...(event.customerExternalId ? { customerExternalId: event.customerExternalId } : {}),
        ...(event.productExternalId ? { productExternalId: event.productExternalId } : {}),
        ...(event.transactionExternalId
          ? { transactionExternalId: event.transactionExternalId }
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

  async process(input: ProcessCommerceEventInput): Promise<ProcessCommerceEventResult> {
    const processedAt = validTimestamp(
      input.processedAt ?? new Date().toISOString(),
      "processedAt",
    );
    validTimestamp(input.event.occurredAt, "event.occurredAt");

    if (input.action !== "none" && !input.entitlement) {
      throw new Error("ENTITLEMENT_IDENTITY_REQUIRED");
    }

    const eventRef = this.eventRef(input.event);
    const entitlementRef = input.entitlement
      ? this.entitlementRef(input.entitlement)
      : undefined;

    return this.firestore.runTransaction(async (transaction) => {
      const eventSnapshot = await transaction.get(eventRef);
      if (!eventSnapshot.exists) throw new Error("COMMERCE_EVENT_NOT_RECEIVED");

      const currentEvent = eventSnapshot.data() as ProviderEventRecord;
      assertEventMatches(currentEvent, input.event);

      const entitlementSnapshot = entitlementRef
        ? await transaction.get(entitlementRef)
        : undefined;
      const currentEntitlement = entitlementSnapshot?.exists
        ? (entitlementSnapshot.data() as EntitlementRecord)
        : undefined;

      if (currentEvent.processingStatus === "processed") {
        return {
          event: currentEvent,
          ...(currentEntitlement ? { entitlement: currentEntitlement } : {}),
          duplicate: true,
          outcome: currentEvent.outcome ?? "no_entitlement_change",
        };
      }

      if (input.action === "none") {
        const processedEvent: ProviderEventRecord = {
          ...currentEvent,
          processingStatus: "processed",
          processingAttempts: currentEvent.processingAttempts + 1,
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

      const identity = input.entitlement!;
      const entitlementId = hashDocumentId(entitlementIdentityKey(identity));

      const transition = applyEntitlementTransition({
        entitlementId,
        identity,
        action: input.action,
        event: input.event,
        appliedAt: processedAt,
        current: currentEntitlement,
      });

      if (transition.changed) {
        transaction.set(entitlementRef!, transition.record);
      }

      const processedEvent: ProviderEventRecord = {
        ...currentEvent,
        processingStatus: "processed",
        processingAttempts: currentEvent.processingAttempts + 1,
        processedAt,
        outcome: transition.outcome,
        resolution: {
          ...identity,
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
      if (!snapshot.exists) throw new Error("COMMERCE_EVENT_NOT_RECEIVED");

      const current = snapshot.data() as ProviderEventRecord;
      assertEventMatches(current, event);

      if (current.processingStatus === "processed") return current;

      const failed: ProviderEventRecord = {
        ...current,
        processingStatus: "failed",
        processingAttempts: current.processingAttempts + 1,
        failedAt,
        lastErrorCode: sanitizedErrorCode(errorCode),
      };

      transaction.set(eventRef, failed);
      return failed;
    });
  }
}
