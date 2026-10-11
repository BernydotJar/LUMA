import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { assertInstitutionConfig } from "./config";
import { parseDraftTenantId } from "./draft-input";
import { parsePreparePlanInput, parseReviewPlanInput, type PreparePlanInput, type ReviewPlanInput } from "./publication-plan-input";
import type { FirestoreInstitutionPublicationInspector, InstitutionPublicationPreflight } from "./publication-preflight";

export type PublicationPlanState = "prepared" | "reviewed" | "withdrawn";
export interface InstitutionPublicationPlan {
  readonly tenantId: string;
  readonly planRevision: number;
  readonly status: PublicationPlanState;
  readonly activationAllowed: false;
  readonly draftConfigVersion: number;
  readonly readinessDigest: string;
  readonly preparedBy: string;
  readonly preparedAt: string;
  readonly reviewedBy?: string;
  readonly reviewedAt?: string;
  readonly withdrawnBy?: string;
  readonly withdrawnAt?: string;
  readonly updatedAt: string;
}
export interface PublicationPlanReceipt {
  readonly tenantId: string;
  readonly appliedPlanRevision: number;
  readonly status: PublicationPlanState;
  readonly duplicate: boolean;
  readonly activationAllowed: false;
}
interface PlanAudit {
  readonly tenantId: string;
  readonly action: "prepare" | "review" | "withdraw";
  readonly actorUid: string;
  readonly requestDigest: string;
  readonly resultingRevision: number;
  readonly resultingStatus: PublicationPlanState;
  readonly occurredAt: string;
  readonly reasonCode: string;
}
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const validActor = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
function validInstant(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)) return false;
  const date = new Date(v);
  return !Number.isNaN(date.getTime()) && date.toISOString() === v;
}
function checkedPlan(raw: unknown, tenantId: string): InstitutionPublicationPlan {
  try {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("bad_data");
    const r = raw as Record<string, unknown>;
    if (r.tenantId !== tenantId || !["prepared", "reviewed", "withdrawn"].includes(r.status as string) ||
        r.activationAllowed !== false || !Number.isSafeInteger(r.planRevision) || (r.planRevision as number) < 1 ||
        !Number.isSafeInteger(r.draftConfigVersion) || (r.draftConfigVersion as number) < 1 ||
        typeof r.readinessDigest !== "string" || !/^[a-f0-9]{64}$/.test(r.readinessDigest) ||
        !validActor(r.preparedBy) || !validInstant(r.preparedAt) || !validInstant(r.updatedAt) ||
        (r.reviewedBy !== undefined && !validActor(r.reviewedBy)) ||
        (r.reviewedAt !== undefined && !validInstant(r.reviewedAt)) ||
        (r.withdrawnBy !== undefined && !validActor(r.withdrawnBy)) ||
        (r.withdrawnAt !== undefined && !validInstant(r.withdrawnAt)) ||
        (r.status === "prepared" && (r.reviewedBy !== undefined || r.reviewedAt !== undefined ||
                                     r.withdrawnBy !== undefined || r.withdrawnAt !== undefined)) ||
        (r.status === "reviewed" && (!validActor(r.reviewedBy) || !validInstant(r.reviewedAt) ||
                                    r.reviewedBy === r.preparedBy || r.withdrawnBy !== undefined ||
                                    r.withdrawnAt !== undefined)) ||
        (r.status === "withdrawn" && (!validActor(r.withdrawnBy) || !validInstant(r.withdrawnAt) ||
                                     (r.reviewedBy !== undefined && r.reviewedBy === r.preparedBy)))) {
      throw new Error("bad_shape");
    }
    return r as unknown as InstitutionPublicationPlan;
  } catch {
    throw new Error("INSTITUTION_PLAN_CORRUPT");
  }
}
function isValidPreflight(snapshot: InstitutionPublicationPreflight, input: PreparePlanInput): boolean {
  return snapshot.tenantId === input.tenantId &&
    snapshot.configVersion === input.expectedDraftVersion &&
    snapshot.inspectionDigest === input.expectedReadinessDigest &&
    snapshot.localChecksPassed === true &&
    snapshot.activationAllowed === false &&
    snapshot.status === "blocked" &&
    snapshot.programs.length > 0 && snapshot.programs.every(p => p.localStatus === "pass" && p.activeOfferings > 0);
}

/** Plans are NOT published configs: this class intentionally has no getByTenantId/publish/activate. */
export class FirestoreInstitutionPublicationPlanStore {
  constructor(
    private readonly firestore: Firestore,
    private readonly inspector: Pick<FirestoreInstitutionPublicationInspector, "inspect">,
  ) {}

  private ref(tenantId: string) {
    parseDraftTenantId(tenantId);
    return this.firestore.collection("institutionPublicationPlans").doc(sha256(tenantId));
  }

  async getPlanForTenant(tenantId: string): Promise<InstitutionPublicationPlan | null> {
    const snapshot = await this.ref(tenantId).get();
    if (!snapshot.exists) return null;
    return checkedPlan(snapshot.data(), tenantId);
  }

  private validatedReceipt(
    raw: unknown, tenantId: string, actorUid: string,
    action: PlanAudit["action"], requestDigest: string,
  ): PublicationPlanReceipt {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("INSTITUTION_PLAN_CORRUPT");
    const rec = raw as Partial<PlanAudit>;
    if (rec.tenantId !== tenantId || rec.action !== action || rec.actorUid !== actorUid ||
        rec.requestDigest !== requestDigest) {
      throw new Error("INSTITUTION_PLAN_REQUEST_REUSE_CONFLICT");
    }
    if (!Number.isSafeInteger(rec.resultingRevision) || (rec.resultingRevision ?? 0) < 1 ||
        !["prepared", "reviewed", "withdrawn"].includes(rec.resultingStatus ?? "")) {
      throw new Error("INSTITUTION_PLAN_CORRUPT");
    }
    return {
      tenantId, appliedPlanRevision: rec.resultingRevision as number,
      status: rec.resultingStatus as PublicationPlanState, duplicate: true, activationAllowed: false,
    };
  }

  private async writeTransition(
    actorUid: string,
    action: PlanAudit["action"],
    input: PreparePlanInput | ReviewPlanInput,
    build: (current: InstitutionPublicationPlan | null) => InstitutionPublicationPlan,
    expectedDraftVersion?: number,
  ): Promise<PublicationPlanReceipt> {
    if (!validActor(actorUid)) throw new Error("INSTITUTION_PLAN_ACTOR_INVALID");
    const head = this.ref(input.tenantId);
    const receipt = head.collection("audit").doc(sha256(input.requestId));
    const digest = sha256(JSON.stringify({ action, actorUid, ...input }));
    // Idempotency must continue to work even if prior evidence has since changed.
    const existing = await receipt.get();
    if (existing.exists) return this.validatedReceipt(existing.data(), input.tenantId, actorUid, action, digest);

    return this.firestore.runTransaction(async (tx: Transaction) => {
      // Firestore requires all transaction reads to happen before any writes.
      const draftRef = this.firestore.collection("institutionConfigDrafts").doc(sha256(input.tenantId));
      const [receiptSnap, headSnap, draftSnap] = await Promise.all([
        tx.get(receipt), tx.get(head),
        expectedDraftVersion === undefined ? Promise.resolve(null) : tx.get(draftRef),
      ]);
      if (receiptSnap.exists) {
        return this.validatedReceipt(receiptSnap.data(), input.tenantId, actorUid, action, digest);
      }
      const current = headSnap.exists ? checkedPlan(headSnap.data(), input.tenantId) : null;
      const previousRevision = current?.planRevision ?? 0;
      if (previousRevision !== input.expectedPlanRevision) {
        throw new Error("INSTITUTION_PLAN_VERSION_CONFLICT");
      }
      if (expectedDraftVersion !== undefined) {
        if (!draftSnap?.exists) throw new Error("INSTITUTION_PLAN_DRAFT_CHANGED");
        const document = draftSnap.data();
        try {
          if (!document || document.status !== "draft" || !document.config) throw new Error("bad_draft");
          assertInstitutionConfig(document.config);
          if (document.config.tenantId !== input.tenantId ||
              document.config.configVersion !== expectedDraftVersion) throw new Error("bad_draft_version");
        } catch {
          throw new Error("INSTITUTION_PLAN_DRAFT_CHANGED");
        }
      }
      if (previousRevision >= Number.MAX_SAFE_INTEGER - 1) {
        throw new Error("INSTITUTION_PLAN_REVISION_EXHAUSTED");
      }
      const next = build(current);
      if (next.tenantId !== input.tenantId || next.planRevision !== previousRevision + 1 ||
          next.activationAllowed !== false || !["prepared", "reviewed", "withdrawn"].includes(next.status)) {
        throw new Error("INSTITUTION_PLAN_TRANSITION_INVALID");
      }
      const audit: PlanAudit = {
        tenantId: input.tenantId, action, actorUid, requestDigest: digest,
        resultingRevision: next.planRevision, resultingStatus: next.status,
        occurredAt: next.updatedAt,
        reasonCode: "reasonCode" in input ? input.reasonCode : "ready-candidate",
      };
      tx.set(head, next);
      tx.create(receipt, audit);
      tx.create(head.collection("revisions").doc(String(next.planRevision).padStart(12, "0")), {
        ...next, action, actionBy: actorUid, reasonCode: audit.reasonCode,
      });
      return {
        tenantId: input.tenantId, appliedPlanRevision: next.planRevision,
        status: next.status, duplicate: false, activationAllowed: false,
      };
    });
  }

  async prepare(input: PreparePlanInput, actorUid: string): Promise<PublicationPlanReceipt> {
    const safe = parsePreparePlanInput(input.tenantId, {
      requestId: input.requestId, expectedPlanRevision: input.expectedPlanRevision,
      expectedDraftVersion: input.expectedDraftVersion, expectedReadinessDigest: input.expectedReadinessDigest,
    });
    // A read-only snapshot is advisory; a production publish operation needs
    // a separate transactional verification of all source offering records.
    // A repeated request is recognized by writeTransition before its transaction,
    // but evidence must be rechecked for a fresh attempt.
    const previous = await this.ref(safe.tenantId).collection("audit").doc(sha256(safe.requestId)).get();
    if (!previous.exists) {
      const snapshot = await this.inspector.inspect(safe.tenantId);
      if (!isValidPreflight(snapshot, safe)) throw new Error("INSTITUTION_PLAN_READINESS_CHANGED");
    }
    return this.writeTransition(actorUid, "prepare", safe, current => {
      if (current && current.status !== "withdrawn") {
        throw new Error("INSTITUTION_PLAN_ALREADY_OPEN");
      }
      const now = new Date().toISOString();
      return {
        tenantId: safe.tenantId, planRevision: (current?.planRevision ?? 0) + 1,
        status: "prepared", activationAllowed: false,
        draftConfigVersion: safe.expectedDraftVersion,
        readinessDigest: safe.expectedReadinessDigest,
        preparedBy: actorUid, preparedAt: now, updatedAt: now,
      };
    }, safe.expectedDraftVersion);
  }

  async transition(input: ReviewPlanInput, actorUid: string): Promise<PublicationPlanReceipt> {
    const safe = parseReviewPlanInput(input.tenantId, {
      requestId: input.requestId, expectedPlanRevision: input.expectedPlanRevision,
      action: input.action, reasonCode: input.reasonCode,
    });
    let reviewedDraftVersion: number | undefined;
    if (safe.action === "review") {
      const previous = await this.ref(safe.tenantId).collection("audit").doc(sha256(safe.requestId)).get();
      if (!previous.exists) {
        const current = await this.getPlanForTenant(safe.tenantId);
        if (!current) throw new Error("INSTITUTION_PLAN_NOT_FOUND");
        if (current.status !== "prepared") throw new Error("INSTITUTION_PLAN_STATE_CONFLICT");
        if (current.preparedBy === actorUid) throw new Error("INSTITUTION_PLAN_SELF_REVIEW_FORBIDDEN");
        reviewedDraftVersion = current.draftConfigVersion;
        const snapshot = await this.inspector.inspect(safe.tenantId);
        if (!isValidPreflight(snapshot, {
          tenantId: safe.tenantId, requestId: safe.requestId,
          expectedPlanRevision: safe.expectedPlanRevision,
          expectedDraftVersion: current.draftConfigVersion,
          expectedReadinessDigest: current.readinessDigest,
        })) throw new Error("INSTITUTION_PLAN_READINESS_CHANGED");
      }
    }
    return this.writeTransition(actorUid, safe.action, safe, current => {
      if (!current) throw new Error("INSTITUTION_PLAN_NOT_FOUND");
      const now = new Date().toISOString();
      if (safe.action === "review") {
        if (current.status !== "prepared") throw new Error("INSTITUTION_PLAN_STATE_CONFLICT");
        if (current.preparedBy === actorUid) throw new Error("INSTITUTION_PLAN_SELF_REVIEW_FORBIDDEN");
        return { ...current, planRevision: current.planRevision + 1, status: "reviewed",
          reviewedBy: actorUid, reviewedAt: now, updatedAt: now, activationAllowed: false };
      }
      if (current.status === "withdrawn") throw new Error("INSTITUTION_PLAN_STATE_CONFLICT");
      return { ...current, planRevision: current.planRevision + 1, status: "withdrawn",
        withdrawnBy: actorUid, withdrawnAt: now, updatedAt: now, activationAllowed: false };
    }, reviewedDraftVersion);
  }
}
