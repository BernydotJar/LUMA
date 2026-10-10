import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { assertInstitutionConfig, composeInstitutionConfig, type InstitutionConfig } from "./config";
import {
  parseDraftTenantId,
  parseDraftCreateInput,
  parseDraftBrandInput,
  type DraftBrandInput,
  type DraftCreateInput,
} from "./draft-input";
import { gruvLanguagesTemplate, lumaPlatformTemplate } from "./templates";

export interface InstitutionDraft {
  readonly status: "draft";
  readonly config: InstitutionConfig;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly updatedBy: string;
}

export interface InstitutionDraftWriteResult {
  tenantId: string;
  appliedVersion: number;
  duplicate: boolean;
}

interface DraftAudit {
  readonly action: "create" | "brand-update";
  readonly tenantId: string;
  readonly actorUid: string;
  readonly requestDigest: string;
  readonly reasonCode: string;
  readonly previousVersion: number;
  readonly appliedVersion: number;
  readonly occurredAt: string;
}

const SHA256 = (text: string) => createHash("sha256").update(text).digest("hex");

function validActor(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function validUtcInstant(value: unknown): value is string {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const instant = new Date(value);
  return !Number.isNaN(instant.getTime()) && instant.toISOString() === value;
}

/** All persisted fields are untrusted, even when loaded with the Admin SDK. */
function checkedDraft(raw: unknown, tenantId: string): InstitutionDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("INSTITUTION_DRAFT_CORRUPT");
  }
  const value = raw as Record<string, unknown>;
  try {
    if (value.status !== "draft" ||
        !validUtcInstant(value.createdAt) || !validUtcInstant(value.updatedAt) ||
        typeof value.createdBy !== "string" || typeof value.updatedBy !== "string" ||
        !validActor(value.createdBy) || !validActor(value.updatedBy) ||
        !value.config || typeof value.config !== "object") {
      throw new Error("invalid_draft_shape");
    }
    const config = value.config as InstitutionConfig;
    assertInstitutionConfig(config);
    if (config.tenantId !== tenantId) throw new Error("wrong_tenant");
    return {
      status: "draft",
      config,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
      createdBy: value.createdBy,
      updatedBy: value.updatedBy,
    };
  } catch {
    throw new Error("INSTITUTION_DRAFT_CORRUPT");
  }
}

export class FirestoreInstitutionDraftStore {
  constructor(private readonly firestore: Firestore) {}

  private draftRef(tenantId: string) {
    parseDraftTenantId(tenantId);
    return this.firestore.collection("institutionConfigDrafts").doc(SHA256(tenantId));
  }

  async getDraftForTenant(tenantId: string): Promise<InstitutionDraft | null> {
    const snapshot = await this.draftRef(tenantId).get();
    if (!snapshot.exists) return null;
    return checkedDraft(snapshot.data(), tenantId);
  }

  // Deliberately no getByTenantId(): drafts cannot satisfy InstitutionConfigStore,
  // which is the runtime boundary for published, entitled learning requests.

  private async updateWithReceipt(
    actorUid: string,
    action: DraftAudit["action"],
    input: DraftCreateInput | DraftBrandInput,
    build: (current: InstitutionDraft | null) => InstitutionConfig,
  ): Promise<InstitutionDraftWriteResult> {
    if (!validActor(actorUid)) throw new Error("INSTITUTION_DRAFT_ACTOR_INVALID");
    const draftRef = this.draftRef(input.tenantId);
    const receiptRef = draftRef.collection("audit").doc(SHA256(input.requestId));
    const requestDigest = SHA256(JSON.stringify({ action, actorUid, ...input }));

    return this.firestore.runTransaction(async (transaction: Transaction) => {
      // All reads precede all writes to satisfy Firestore transaction semantics.
      const [receiptSnapshot, draftSnapshot] = await Promise.all([
        transaction.get(receiptRef),
        transaction.get(draftRef),
      ]);
      if (receiptSnapshot.exists) {
        const receipt = receiptSnapshot.data() as Partial<DraftAudit> | undefined;
        if (receipt?.requestDigest !== requestDigest ||
            receipt.actorUid !== actorUid || receipt.tenantId !== input.tenantId ||
            receipt.action !== action) {
          throw new Error("INSTITUTION_DRAFT_REQUEST_REUSE_CONFLICT");
        }
        if (!Number.isSafeInteger(receipt.appliedVersion) || (receipt.appliedVersion ?? 0) < 1) {
          throw new Error("INSTITUTION_DRAFT_CORRUPT");
        }
        return {
          tenantId: input.tenantId,
          appliedVersion: receipt.appliedVersion as number,
          duplicate: true,
        };
      }

      const current = draftSnapshot.exists ? checkedDraft(draftSnapshot.data(), input.tenantId) : null;
      if (action === "brand-update" && !current) {
        throw new Error("INSTITUTION_DRAFT_NOT_FOUND");
      }
      const currentVersion = current?.config.configVersion ?? 0;
      if (currentVersion !== input.expectedVersion) {
        throw new Error("INSTITUTION_DRAFT_VERSION_CONFLICT");
      }
      const nextConfig = build(current);
      assertInstitutionConfig(nextConfig);
      if (nextConfig.tenantId !== input.tenantId ||
          nextConfig.configVersion !== currentVersion + 1) {
        throw new Error("INSTITUTION_DRAFT_UPDATE_INVALID");
      }
      const now = new Date().toISOString();
      const nextDraft: InstitutionDraft = {
        status: "draft",
        config: nextConfig,
        createdAt: current?.createdAt ?? now,
        createdBy: current?.createdBy ?? actorUid,
        updatedAt: now,
        updatedBy: actorUid,
      };
      const receipt: DraftAudit = {
        action,
        tenantId: input.tenantId,
        actorUid,
        requestDigest,
        reasonCode: input.reasonCode,
        previousVersion: currentVersion,
        appliedVersion: nextConfig.configVersion,
        occurredAt: now,
      };
      transaction.set(draftRef, nextDraft);
      transaction.create(receiptRef, receipt);
      return { tenantId: input.tenantId, appliedVersion: nextConfig.configVersion, duplicate: false };
    });
  }

  async createDraft(input: DraftCreateInput, actorUid: string): Promise<InstitutionDraftWriteResult> {
    // Validate at the persistence boundary as well as at HTTP: future callers
    // must not be able to bypass idempotency, tenant or input constraints.
    const safe = parseDraftCreateInput(input.tenantId, {
      templateId: input.templateId, programIds: input.programIds,
      expectedVersion: input.expectedVersion, requestId: input.requestId,
      reasonCode: input.reasonCode,
    });
    const template = safe.templateId === "luma-platform" ? lumaPlatformTemplate :
      safe.templateId === "gruv-languages" ? gruvLanguagesTemplate : null;
    if (!template) throw new Error("INSTITUTION_DRAFT_TEMPLATE_INVALID");
    return this.updateWithReceipt(actorUid, "create", safe, current => {
      if (current) throw new Error("INSTITUTION_DRAFT_ALREADY_EXISTS");
      return composeInstitutionConfig(template, safe.tenantId, safe.programIds, 1);
    });
  }

  async updateDraftBrand(input: DraftBrandInput, actorUid: string): Promise<InstitutionDraftWriteResult> {
    const safe = parseDraftBrandInput(input.tenantId, {
      brand: input.brand, expectedVersion: input.expectedVersion,
      requestId: input.requestId, reasonCode: input.reasonCode,
    });
    return this.updateWithReceipt(actorUid, "brand-update", safe, current => {
      if (!current) throw new Error("INSTITUTION_DRAFT_NOT_FOUND");
      const next: InstitutionConfig = {
        ...current.config,
        configVersion: current.config.configVersion + 1,
        brand: {
          ...current.config.brand,
          displayName: safe.brand.displayName,
          shortName: safe.brand.shortName,
          palette: [...safe.brand.palette],
        },
      };
      return next;
    });
  }
}
