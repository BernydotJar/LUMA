import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { CommerceProviderId } from "./domain";
import type { CommerceProductMapping } from "./mapping";

export interface CommerceProviderBinding {
  provider: CommerceProviderId;
  transactionExternalId: string;
  tenantId: string;
  productId: string;
  programId: string;
  customerId: string;
  email?: string;
  entitlementId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderBindingInput {
  provider: CommerceProviderId;
  transactionExternalId: string;
  mapping: Pick<
    CommerceProductMapping,
    "tenantId" | "productId" | "programId"
  >;
  customerId: string;
  email?: string;
  entitlementId: string;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 320) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function documentId(
  provider: CommerceProviderId,
  transactionExternalId: string,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        required(provider, "provider"),
        required(
          transactionExternalId,
          "transactionExternalId",
        ),
      ]),
    )
    .digest("hex");
}

function normalizedEmail(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

export class FirestoreCommerceProviderBindingStore {
  constructor(private readonly firestore: Firestore) {}

  private ref(
    provider: CommerceProviderId,
    transactionExternalId: string,
  ) {
    return this.firestore
      .collection("commerceProviderBindings")
      .doc(documentId(provider, transactionExternalId));
  }

  async get(
    provider: CommerceProviderId,
    transactionExternalId: string,
  ): Promise<CommerceProviderBinding | undefined> {
    const snapshot = await this.ref(
      provider,
      transactionExternalId,
    ).get();
    return snapshot.exists
      ? (snapshot.data() as CommerceProviderBinding)
      : undefined;
  }

  async upsert(
    input: ProviderBindingInput,
    now = new Date().toISOString(),
  ): Promise<CommerceProviderBinding> {
    if (!Number.isFinite(Date.parse(now))) {
      throw new Error("binding timestamp must be valid ISO");
    }
    const provider = required(
      input.provider,
      "provider",
    ) as CommerceProviderId;
    const transactionExternalId = required(
      input.transactionExternalId,
      "transactionExternalId",
    );
    const ref = this.ref(provider, transactionExternalId);

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists
        ? (snapshot.data() as CommerceProviderBinding)
        : undefined;

      const immutableIdentity = {
        tenantId: required(input.mapping.tenantId, "tenantId"),
        productId: required(input.mapping.productId, "productId"),
        programId: required(input.mapping.programId, "programId"),
        customerId: required(input.customerId, "customerId"),
      };

      if (
        current &&
        (current.tenantId !== immutableIdentity.tenantId ||
          current.productId !== immutableIdentity.productId ||
          current.programId !== immutableIdentity.programId ||
          current.customerId !== immutableIdentity.customerId)
      ) {
        throw new Error("PROVIDER_BINDING_CONFLICT");
      }

      const email =
        normalizedEmail(input.email) ?? current?.email;
      const record: CommerceProviderBinding = {
        provider,
        transactionExternalId,
        ...immutableIdentity,
        ...(email ? { email } : {}),
        entitlementId: required(
          input.entitlementId,
          "entitlementId",
        ),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };

      transaction.set(ref, record);
      return record;
    });
  }
}
