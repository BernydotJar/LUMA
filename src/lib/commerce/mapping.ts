import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { CommerceProviderId } from "./domain";

export interface CommerceProductMapping {
  provider: CommerceProviderId;
  externalProductId: string;
  tenantId: string;
  productId: string;
  programId: string;
  offeringId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommerceProductMappingInput {
  provider: CommerceProviderId;
  externalProductId: string;
  tenantId: string;
  productId: string;
  programId: string;
  offeringId?: string | null;
  active?: boolean;
}

export interface CommerceProductMappingStore {
  resolve(
    provider: CommerceProviderId,
    externalProductId: string,
  ): Promise<CommerceProductMapping | undefined>;
  upsert(
    input: CommerceProductMappingInput,
    updatedAt?: string,
  ): Promise<CommerceProductMapping>;
  list(limit?: number): Promise<CommerceProductMapping[]>;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 160) {
    throw new Error(`${label} must be 1-160 characters`);
  }
  return normalized;
}

function key(provider: CommerceProviderId, externalProductId: string): string {
  return JSON.stringify([
    required(provider, "provider"),
    required(externalProductId, "externalProductId"),
  ]);
}

function documentId(provider: CommerceProviderId, externalProductId: string) {
  return createHash("sha256")
    .update(key(provider, externalProductId))
    .digest("hex");
}

function validIso(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return value;
}

export class FirestoreCommerceProductMappingStore
  implements CommerceProductMappingStore
{
  constructor(private readonly firestore: Firestore) {}

  private ref(provider: CommerceProviderId, externalProductId: string) {
    return this.firestore
      .collection("commerceProductMappings")
      .doc(documentId(provider, externalProductId));
  }

  async resolve(
    provider: CommerceProviderId,
    externalProductId: string,
  ): Promise<CommerceProductMapping | undefined> {
    const snapshot = await this.ref(provider, externalProductId).get();
    if (!snapshot.exists) return undefined;
    const mapping = snapshot.data() as CommerceProductMapping;
    return mapping.active ? mapping : undefined;
  }

  async upsert(
    input: CommerceProductMappingInput,
    updatedAt = new Date().toISOString(),
  ): Promise<CommerceProductMapping> {
    validIso(updatedAt, "updatedAt");
    const normalized = {
      provider: required(input.provider, "provider") as CommerceProviderId,
      externalProductId: required(
        input.externalProductId,
        "externalProductId",
      ),
      tenantId: required(input.tenantId, "tenantId"),
      productId: required(input.productId, "productId"),
      programId: required(input.programId, "programId"),
    };
    const ref = this.ref(
      normalized.provider,
      normalized.externalProductId,
    );

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists
        ? (snapshot.data() as CommerceProductMapping)
        : undefined;
      const record: CommerceProductMapping = {
        ...normalized,
        ...(input.offeringId === null
          ? {}
          : input.offeringId !== undefined
            ? { offeringId: required(input.offeringId, "offeringId") }
            : current?.offeringId ? { offeringId: current.offeringId } : {}),
        active: input.active ?? current?.active ?? true,
        createdAt: current?.createdAt ?? updatedAt,
        updatedAt,
      };
      transaction.set(ref, record);
      return record;
    });
  }

  async list(limit = 100): Promise<CommerceProductMapping[]> {
    const snapshot = await this.firestore
      .collection("commerceProductMappings")
      .limit(Math.max(1, Math.min(limit, 250)))
      .get();
    return snapshot.docs
      .map((doc) => doc.data() as CommerceProductMapping)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
