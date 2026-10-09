import { createHash } from "node:crypto";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
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

export interface CommerceMappingPage {
  mappings: CommerceProductMapping[];
  nextCursor: string | null;
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
  listPage(limit?: number, cursor?: string): Promise<CommerceMappingPage>;
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
    const page = await this.listPage(limit);
    return page.mappings;
  }

  async listPage(limit = 100, cursor?: string): Promise<CommerceMappingPage> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      throw new Error("COMMERCE_MAPPING_PAGE_LIMIT_INVALID");
    }
    if (cursor && !/^[a-f0-9]{64}$/.test(cursor)) {
      throw new Error("COMMERCE_MAPPING_CURSOR_INVALID");
    }
    let query = this.firestore
      .collection("commerceProductMappings")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(limit + 1);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, limit);
    return {
      mappings: docs.map((doc) => doc.data() as CommerceProductMapping),
      nextCursor: snapshot.size > limit ? docs.at(-1)?.id ?? null : null,
    };
  }
}
