import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { assessmentCatalogPaths, validatePublishedProgramAssessment } from "./program-assessment-registry";
import {
  parseAssessmentScope, parsePrepareAssessment, parseTransitionAssessment,
  safeAssessmentActor, sourcesForPublishedClasses,
  type AssessmentPublishAction, type PrepareAssessmentInput, type TransitionAssessmentInput,
} from "./assessment-publication-input";
import type { LearningScope } from "./learning-entitlement";

export type AssessmentPlanStatus = "prepared" | "reviewed" | "published" | "withdrawn";
export interface AssessmentPublicationPlan extends LearningScope {
  schemaVersion: 1;
  planRevision: number;
  status: AssessmentPlanStatus;
  offeringId: string;
  version: string;
  curriculumRevision: string;
  classSlugs: string[];
  sourceIds: string[];
  recommendedNextSlug: string;
  basePointerDigest: string;
  preparedBy: string;
  preparedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rightsRecordId?: string;
  rightsEvidenceSha256?: string;
  publishedBy?: string;
  publishedAt?: string;
  withdrawnBy?: string;
  withdrawnAt?: string;
  updatedAt: string;
}
export interface AssessmentPublicationReceipt {
  tenantId: string;
  programId: string;
  appliedRevision: number;
  status: AssessmentPlanStatus;
  activeVersion: string | null;
  duplicate: boolean;
}
type Action = "prepare" | AssessmentPublishAction;
type Audit = {
  actorUid: string;
  action: Action;
  requestDigest: string;
  tenantId: string;
  programId: string;
  appliedRevision: number;
  status: AssessmentPlanStatus;
  activeVersion: string | null;
  reasonCode: string;
  occurredAt: string;
};
type Offering = { offeringId?: unknown; tenantId?: unknown; programId?: unknown; status?: unknown };
const sha = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");
const isIso = (value: unknown) => typeof value === "string" &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const versionPattern = /^[a-z][a-z0-9-]{2,95}$/;
function checkedPlan(raw: unknown, scope: LearningScope): AssessmentPublicationPlan {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("ASSESSMENT_PUBLICATION_CORRUPT");
  const p = raw as AssessmentPublicationPlan;
  if (p.schemaVersion !== 1 || p.tenantId !== scope.tenantId || p.programId !== scope.programId ||
    !["prepared", "reviewed", "published", "withdrawn"].includes(p.status) ||
    !Number.isSafeInteger(p.planRevision) || p.planRevision < 1 ||
    !safeAssessmentActor(p.offeringId) || !versionPattern.test(p.version) ||
    !versionPattern.test(p.curriculumRevision) || !safeAssessmentActor(p.preparedBy) ||
    !isIso(p.preparedAt) || !isIso(p.updatedAt) ||
    typeof p.basePointerDigest !== "string" || !/^[a-f0-9]{64}$/.test(p.basePointerDigest) ||
    !Array.isArray(p.classSlugs) || !Array.isArray(p.sourceIds) ||
    typeof p.recommendedNextSlug !== "string" ||
    !p.classSlugs.includes(p.recommendedNextSlug)) throw new Error("ASSESSMENT_PUBLICATION_CORRUPT");
  try {
    const sources = sourcesForPublishedClasses(p.classSlugs);
    if (sha(sources) !== sha([...p.sourceIds].sort())) throw new Error("invalid");
  } catch { throw new Error("ASSESSMENT_PUBLICATION_CORRUPT"); }
  if (p.status === "reviewed" || p.status === "published" ||
    (p.status === "withdrawn" && p.reviewedBy !== undefined)) {
    if (!safeAssessmentActor(p.reviewedBy) || p.reviewedBy === p.preparedBy ||
      !isIso(p.reviewedAt) || !safeAssessmentActor(p.rightsRecordId) ||
      typeof p.rightsEvidenceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(p.rightsEvidenceSha256)) {
      throw new Error("ASSESSMENT_PUBLICATION_CORRUPT");
    }
  }
  if (p.status === "published" && (!safeAssessmentActor(p.publishedBy) ||
      !isIso(p.publishedAt) || p.publishedBy === p.reviewedBy)) throw new Error("ASSESSMENT_PUBLICATION_CORRUPT");
  return p;
}
function pointerFingerprint(raw: unknown) {
  if (!raw) return sha(null);
  const p = raw as Record<string, unknown>;
  return sha({
    schemaVersion: p.schemaVersion, tenantId: p.tenantId, programId: p.programId,
    status: p.status, activeVersion: p.activeVersion, offeringId: p.offeringId,
  });
}
function assertOffering(raw: unknown, scope: LearningScope, offeringId: string) {
  const o = raw as Offering | undefined;
  if (!o || o.offeringId !== offeringId || o.tenantId !== scope.tenantId ||
    o.programId !== scope.programId || o.status !== "active") {
    throw new Error("ASSESSMENT_PUBLICATION_OFFERING_UNAVAILABLE");
  }
}
function receipt(scope: LearningScope, revision: number, status: AssessmentPlanStatus,
  activeVersion: string | null, duplicate: boolean): AssessmentPublicationReceipt {
  return { ...scope, appliedRevision: revision, status, activeVersion, duplicate };
}

/**
 * Application-level append-only publication ledger. Each transition is an
 * optimistic Firestore transaction and creates an immutable audit + revision.
 * The published catalog version is created once and NEVER overwritten.
 */
export class FirestoreAssessmentPublicationStore {
  constructor(private readonly db: Firestore) {}
  private refs(scope: LearningScope) {
    const paths = assessmentCatalogPaths(scope);
    return {
      head: this.db.collection("assessmentPublicationPlans").doc(sha([scope.tenantId, scope.programId])),
      pointer: this.db.doc(paths.pointer),
      version: (id: string) => this.db.doc(paths.version(id)),
    };
  }
  async get(scope: LearningScope) {
    const clean = parseAssessmentScope(scope.tenantId, scope.programId);
    const refs = this.refs(clean);
    const [head, pointer] = await Promise.all([refs.head.get(), refs.pointer.get()]);
    return {
      plan: head.exists ? checkedPlan(head.data(), clean) : null,
      publication: pointer.exists ? {
        status: pointer.get("status") as string,
        activeVersion: pointer.get("activeVersion") as string,
      } : null,
    };
  }

  private async write(
    raw: PrepareAssessmentInput | TransitionAssessmentInput,
    actor: string,
    action: Action,
  ): Promise<AssessmentPublicationReceipt> {
    if (!safeAssessmentActor(actor)) throw new Error("ASSESSMENT_PUBLICATION_ACTOR_INVALID");
    const scope = parseAssessmentScope(raw.tenantId, raw.programId);
    // The only callers are the public wrappers, which already ran the strict
    // parser. Re-parsing here would treat server-added scope fields as forged
    // client payload (and block all real requests).
    const input = raw;
    const refs = this.refs(scope);
    const auditRef = refs.head.collection("audit").doc(sha(input.requestId));
    const requestDigest = sha([action, actor, input]);

    return this.db.runTransaction(async (tx: Transaction) => {
      // Transaction reads precede writes. No client-controlled document path
      // can escape the tenant+program scope or override an old published pack.
      const [existing, headSnap, pointerSnap] = await Promise.all([
        tx.get(auditRef), tx.get(refs.head), tx.get(refs.pointer),
      ]);
      if (existing.exists) {
        const previous = existing.data() as Partial<Audit> | undefined;
        if (!previous || previous.requestDigest !== requestDigest ||
          previous.actorUid !== actor || previous.action !== action ||
          previous.tenantId !== scope.tenantId || previous.programId !== scope.programId ||
          !Number.isSafeInteger(previous.appliedRevision) ||
          !["prepared", "reviewed", "published", "withdrawn"].includes(previous.status ?? "")) {
          throw new Error("ASSESSMENT_PUBLICATION_REQUEST_REUSE_CONFLICT");
        }
        return receipt(scope, previous.appliedRevision!, previous.status!,
          previous.activeVersion ?? null, true);
      }
      const current = headSnap.exists ? checkedPlan(headSnap.data(), scope) : null;
      const previousRev = current?.planRevision ?? 0;
      if (previousRev !== input.expectedPlanRevision) {
        throw new Error("ASSESSMENT_PUBLICATION_REVISION_CONFLICT");
      }
      if (previousRev >= 1000000) throw new Error("ASSESSMENT_PUBLICATION_REVISION_EXHAUSTED");
      const target = action === "prepare" ? input as PrepareAssessmentInput : null;
      const offeringId = target?.offeringId ?? current?.offeringId;
      if (!offeringId) throw new Error("ASSESSMENT_PUBLICATION_NOT_FOUND");
      const needsOffering = action !== "withdraw";
      const offeringRef = this.db.collection("programOfferings").doc(offeringId);
      const newVersionRef = refs.version(target?.version ?? current!.version);
      const [offeringSnap, versionSnap] = await Promise.all([
        needsOffering ? tx.get(offeringRef) : Promise.resolve(null),
        action === "prepare" || action === "publish" ? tx.get(newVersionRef) : Promise.resolve(null),
      ]);
      if (needsOffering) assertOffering(offeringSnap?.data(), scope, offeringId);
      if ((action === "prepare" || action === "publish") && versionSnap?.exists) {
        throw new Error("ASSESSMENT_PUBLICATION_VERSION_REUSED");
      }
      const now = new Date().toISOString();
      let next: AssessmentPublicationPlan;
      let nextPointer: Record<string, unknown> | undefined;
      let publishedRevision: Record<string, unknown> | undefined;
      if (action === "prepare") {
        if (current && !["published", "withdrawn"].includes(current.status)) {
          throw new Error("ASSESSMENT_PUBLICATION_ALREADY_OPEN");
        }
        const proposed = input as PrepareAssessmentInput;
        next = {
          schemaVersion: 1, tenantId: scope.tenantId, programId: scope.programId,
          planRevision: previousRev + 1, status: "prepared",
          offeringId: proposed.offeringId, version: proposed.version,
          curriculumRevision: proposed.curriculumRevision,
          classSlugs: [...proposed.classSlugs],
          sourceIds: sourcesForPublishedClasses(proposed.classSlugs),
          recommendedNextSlug: proposed.recommendedNextSlug,
          basePointerDigest: pointerFingerprint(pointerSnap.data()),
          preparedBy: actor, preparedAt: now, updatedAt: now,
        };
      } else {
        if (!current) throw new Error("ASSESSMENT_PUBLICATION_NOT_FOUND");
        const cmd = input as TransitionAssessmentInput;
        if (action === "review") {
          if (current.status !== "prepared") throw new Error("ASSESSMENT_PUBLICATION_STATE_CONFLICT");
          if (actor === current.preparedBy) throw new Error("ASSESSMENT_PUBLICATION_SELF_REVIEW_FORBIDDEN");
          next = {
            ...current, planRevision: previousRev + 1, status: "reviewed",
            reviewedBy: actor, reviewedAt: now, rightsRecordId: cmd.rightsRecordId!,
            rightsEvidenceSha256: cmd.rightsEvidenceSha256!, updatedAt: now,
          };
        } else if (action === "publish") {
          if (current.status !== "reviewed") throw new Error("ASSESSMENT_PUBLICATION_STATE_CONFLICT");
          if (actor === current.reviewedBy) throw new Error("ASSESSMENT_PUBLICATION_SELF_PUBLICATION_FORBIDDEN");
          if (pointerFingerprint(pointerSnap.data()) !== current.basePointerDigest) {
            throw new Error("ASSESSMENT_PUBLICATION_PUBLISHED_HEAD_CHANGED");
          }
          publishedRevision = {
            schemaVersion: 1, tenantId: scope.tenantId, programId: scope.programId,
            offeringId: current.offeringId, version: current.version, status: "approved",
            curriculumRevision: current.curriculumRevision, classSlugs: [...current.classSlugs],
            sourceIds: [...current.sourceIds], recommendedNextSlug: current.recommendedNextSlug,
            submittedByUid: current.preparedBy, approvedByUid: current.reviewedBy,
            approvedAt: current.reviewedAt, publishedAt: now,
            // Documentary reference; this attestation is NOT an external proof of rights.
            rightsRecordId: current.rightsRecordId, rightsEvidenceSha256: current.rightsEvidenceSha256,
          };
          nextPointer = {
            schemaVersion: 1, tenantId: scope.tenantId, programId: scope.programId,
            offeringId: current.offeringId, status: "published", activeVersion: current.version,
          };
          if (!validatePublishedProgramAssessment(scope, nextPointer, publishedRevision, offeringSnap?.data())) {
            throw new Error("ASSESSMENT_PUBLICATION_CONTRACT_INVALID");
          }
          next = {
            ...current, planRevision: previousRev + 1,
            status: "published", publishedBy: actor, publishedAt: now, updatedAt: now,
          };
        } else {
          if (current.status === "withdrawn") throw new Error("ASSESSMENT_PUBLICATION_STATE_CONFLICT");
          next = {
            ...current, planRevision: previousRev + 1, status: "withdrawn",
            withdrawnBy: actor, withdrawnAt: now, updatedAt: now,
          };
          // Withdrawing a *draft* must never disable a previously published curriculum.
          if (current.status === "published") {
            const pointer = pointerSnap.data() as Record<string, unknown> | undefined;
            if (pointer?.status !== "published" || pointer.activeVersion !== current.version) {
              throw new Error("ASSESSMENT_PUBLICATION_PUBLISHED_HEAD_CHANGED");
            }
            nextPointer = { ...pointer, status: "withdrawn" };
          }
        }
      }
      const activeVersion = nextPointer?.status === "published" ? String(nextPointer.activeVersion) :
        (nextPointer?.status === "withdrawn" ? null :
          pointerSnap.get("status") === "published" ? String(pointerSnap.get("activeVersion")) : null);
      const audit: Audit = {
        actorUid: actor, action, requestDigest, ...scope,
        appliedRevision: next.planRevision, status: next.status,
        activeVersion, reasonCode: input.reasonCode, occurredAt: now,
      };
      tx.set(refs.head, next);
      tx.create(auditRef, audit);
      tx.create(refs.head.collection("revisions").doc(String(next.planRevision).padStart(12, "0")), {
        ...next, action, actionBy: actor, reasonCode: input.reasonCode,
        requestDigest, occurredAt: now,
      });
      if (publishedRevision) tx.create(newVersionRef, publishedRevision);
      if (nextPointer) tx.set(refs.pointer, nextPointer);
      return receipt(scope, next.planRevision, next.status, activeVersion, false);
    });
  }
  async prepare(scope: LearningScope, raw: unknown, actor: string) {
    const input = parsePrepareAssessment(scope, raw);
    return this.write(input, actor, "prepare");
  }
  async transition(scope: LearningScope, raw: unknown, actor: string) {
    const input = parseTransitionAssessment(scope, raw);
    return this.write(input, actor, input.action);
  }
}
