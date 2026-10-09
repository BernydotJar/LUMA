import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  compareCommerceEventTimes,
  type CommerceProviderId,
  type EntitlementRecord,
  type NormalizedCommerceEvent,
} from "./domain";
import type { CommerceProductMapping } from "./mapping";

export type CommerceEnrollmentStatus = "active" | "revoked";

export interface CommerceEnrollmentRecord {
  enrollmentId: string;
  tenantId: string;
  programId: string;
  productId: string;
  offeringId?: string;
  customerId: string;
  email?: string;
  learnerId?: string;
  entitlementId: string;
  status: CommerceEnrollmentStatus;
  accessEndsAt?: string;
  createdAt: string;
  updatedAt: string;
  lastProvider: CommerceProviderId;
  lastProviderEventId: string;
  lastEventAt: string;
}

export function isActiveCommerceEnrollment(
  record: CommerceEnrollmentRecord,
  now = new Date().toISOString(),
): boolean {
  return record.status === "active" &&
    (!record.accessEndsAt || Date.parse(record.accessEndsAt) > Date.parse(now));
}

export interface ApplyCommerceEnrollmentInput {
  mapping: Pick<
    CommerceProductMapping,
    "tenantId" | "productId" | "programId" | "offeringId"
  >;
  entitlement: EntitlementRecord;
  event: NormalizedCommerceEvent;
  email?: string;
  appliedAt?: string;
}

export interface ApplyCommerceEnrollmentResult {
  record: CommerceEnrollmentRecord;
  duplicate: boolean;
  ignoredStale: boolean;
}

function normalizedEmail(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (
    normalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new Error("buyer email is invalid");
  }
  return normalized;
}

function enrollmentIdentity(
  tenantId: string,
  customerId: string,
  programId: string,
): string {
  return JSON.stringify([
    tenantId.trim(),
    customerId.trim(),
    programId.trim(),
  ]);
}

function documentId(
  tenantId: string,
  customerId: string,
  programId: string,
) {
  return createHash("sha256")
    .update(enrollmentIdentity(tenantId, customerId, programId))
    .digest("hex");
}

export class FirestoreCommerceEnrollmentStore {
  constructor(private readonly firestore: Firestore) {}

  private ref(
    tenantId: string,
    customerId: string,
    programId: string,
  ) {
    return this.firestore
      .collection("commerceEnrollments")
      .doc(documentId(tenantId, customerId, programId));
  }

  async apply(
    input: ApplyCommerceEnrollmentInput,
  ): Promise<ApplyCommerceEnrollmentResult> {
    const appliedAt = input.appliedAt ?? new Date().toISOString();
    if (!Number.isFinite(Date.parse(appliedAt))) {
      throw new Error("appliedAt must be a valid ISO timestamp");
    }

    const email = normalizedEmail(input.email);
    const ref = this.ref(
      input.mapping.tenantId,
      input.entitlement.customerId,
      input.mapping.programId,
    );

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists
        ? (snapshot.data() as CommerceEnrollmentRecord)
        : undefined;

      if (
        current?.lastProvider === input.event.provider &&
        current.lastProviderEventId === input.event.externalEventId
      ) {
        return {
          record: current,
          duplicate: true,
          ignoredStale: false,
        };
      }

      if (
        current &&
        compareCommerceEventTimes(
          input.event.occurredAt,
          current.lastEventAt,
        ) < 0
      ) {
        return {
          record: current,
          duplicate: false,
          ignoredStale: true,
        };
      }

      const enrollmentId = documentId(
        input.mapping.tenantId,
        input.entitlement.customerId,
        input.mapping.programId,
      );
      const record: CommerceEnrollmentRecord = {
        enrollmentId,
        tenantId: input.mapping.tenantId,
        programId: input.mapping.programId,
        productId: input.mapping.productId,
        ...(input.mapping.offeringId
          ? { offeringId: input.mapping.offeringId }
          : current?.offeringId ? { offeringId: current.offeringId } : {}),
        customerId: input.entitlement.customerId,
        ...(email
          ? { email }
          : current?.email
            ? { email: current.email }
            : {}),
        ...(current?.learnerId
          ? { learnerId: current.learnerId }
          : {}),
        entitlementId: input.entitlement.entitlementId,
        status:
          input.entitlement.status === "active"
            ? "active"
            : "revoked",
        createdAt: current?.createdAt ?? appliedAt,
        updatedAt: appliedAt,
        lastProvider: input.event.provider,
        lastProviderEventId: input.event.externalEventId,
        lastEventAt: input.event.occurredAt,
      };

      transaction.set(ref, record);
      return {
        record,
        duplicate: false,
        ignoredStale: false,
      };
    });
  }

  async scheduleExpiry(input: {
    mapping: Pick<CommerceProductMapping, "tenantId" | "productId" | "programId">;
    customerId: string;
    event: NormalizedCommerceEvent;
    accessEndsAt: string;
  }): Promise<CommerceEnrollmentRecord> {
    if (!Number.isFinite(Date.parse(input.accessEndsAt))) {
      throw new Error("COMMERCE_ACCESS_END_INVALID");
    }
    const ref = this.ref(input.mapping.tenantId, input.customerId, input.mapping.programId);
    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("COMMERCE_ENROLLMENT_NOT_FOUND");
      const current = snapshot.data() as CommerceEnrollmentRecord;
      if (current.lastProvider === input.event.provider &&
          current.lastProviderEventId === input.event.externalEventId) return current;
      if (compareCommerceEventTimes(input.event.occurredAt, current.lastEventAt) < 0) {
        return current;
      }
      const updated: CommerceEnrollmentRecord = {
        ...current,
        accessEndsAt: input.accessEndsAt,
        updatedAt: new Date().toISOString(),
        lastProvider: input.event.provider,
        lastProviderEventId: input.event.externalEventId,
        lastEventAt: input.event.occurredAt,
      };
      transaction.set(ref, updated);
      return updated;
    });
  }

  async claimByEmail(
    learnerId: string,
    email: string,
  ): Promise<CommerceEnrollmentRecord[]> {
    const normalizedLearnerId = learnerId.trim();
    if (!normalizedLearnerId) throw new Error("learnerId is required");
    const normalized = normalizedEmail(email);
    if (!normalized) throw new Error("email is required");

    const snapshot = await this.firestore
      .collection("commerceEnrollments")
      .where("email", "==", normalized)
      .get();

    const claimed: CommerceEnrollmentRecord[] = [];
    for (const doc of snapshot.docs) {
      const record = doc.data() as CommerceEnrollmentRecord;
      if (!isActiveCommerceEnrollment(record)) continue;

      const updated = await this.firestore.runTransaction(
        async (transaction) => {
          const freshSnapshot = await transaction.get(doc.ref);
          if (!freshSnapshot.exists) return undefined;
          const fresh =
            freshSnapshot.data() as CommerceEnrollmentRecord;
          if (!isActiveCommerceEnrollment(fresh)) return undefined;
          if (
            fresh.learnerId &&
            fresh.learnerId !== normalizedLearnerId
          ) {
            throw new Error("ENROLLMENT_ALREADY_CLAIMED");
          }
          if (fresh.learnerId === normalizedLearnerId) return fresh;

          const next: CommerceEnrollmentRecord = {
            ...fresh,
            learnerId: normalizedLearnerId,
            updatedAt: new Date().toISOString(),
          };
          transaction.set(doc.ref, next);
          return next;
        },
      );
      if (updated) claimed.push(updated);
    }

    return claimed.sort((a, b) =>
      a.programId.localeCompare(b.programId),
    );
  }

  async listActiveLearnerIdsByTenants(
    tenantIds: string[],
  ): Promise<string[]> {
    const normalized = [...new Set(tenantIds.map((id) => id.trim()).filter(Boolean))];
    if (normalized.length === 0) return [];

    const snapshots = await Promise.all(
      normalized.map((tenantId) =>
        this.firestore
          .collection("commerceEnrollments")
          .where("tenantId", "==", tenantId)
          .get(),
      ),
    );

    const learnerIds = new Set<string>();
    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        const record = doc.data() as CommerceEnrollmentRecord;
        if (isActiveCommerceEnrollment(record) && record.learnerId) {
          learnerIds.add(record.learnerId);
        }
      }
    }
    return [...learnerIds].sort();
  }

  async learnerHasActiveTenantAccess(
    learnerId: string,
    tenantIds: string[],
  ): Promise<boolean> {
    const allowed = new Set(tenantIds.map((id) => id.trim()).filter(Boolean));
    if (allowed.size === 0) return false;
    const enrollments = await this.listByLearner(learnerId);
    return enrollments.some(
      (record) => isActiveCommerceEnrollment(record) && allowed.has(record.tenantId),
    );
  }

  async listByLearner(
    learnerId: string,
  ): Promise<CommerceEnrollmentRecord[]> {
    const snapshot = await this.firestore
      .collection("commerceEnrollments")
      .where("learnerId", "==", learnerId.trim())
      .get();
    return snapshot.docs
      .map((doc) => doc.data() as CommerceEnrollmentRecord)
      .sort((a, b) => a.programId.localeCompare(b.programId));
  }
}
