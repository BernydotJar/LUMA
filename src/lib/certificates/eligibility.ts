import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import type { ProgramOffering } from "@/lib/program-delivery";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
const validHash = (hash: unknown): hash is string =>
  typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash);

export interface CertificateAssessmentPolicy {
  schemaVersion: 1;
  tenantId: string;
  programId: string;
  offeringId: string;
  curriculumVersionId: string;
  minimumScore: number;
  requiredItemIds: string[];
  status: "approved";
  authoredBy: string;
  approvedBy: string;
  approvedAt: string;
}

export interface CertificateAssessmentProof {
  policyVersionId: string;
  policyDigest: string;
  evidenceSubmissionIds: string[];
  minimumScore: number;
  curriculumDigest: string;
}

type CurriculumItem = {
  id: string;
  kind: "multiple_choice" | "open" | "exercise";
  correctChoiceId?: string;
};

type EvidenceRow = {
  submissionId?: unknown;
  tenantId?: unknown;
  programId?: unknown;
  offeringId?: unknown;
  learnerUid?: unknown;
  curriculumVersionId?: unknown;
  itemId?: unknown;
  itemKind?: unknown;
  status?: unknown;
  score?: unknown;
  response?: unknown;
  operationId?: unknown;
  consentToCoach?: unknown;
};

function approvedPolicy(raw: unknown, offering: ProgramOffering): CertificateAssessmentPolicy {
  if (!raw || typeof raw !== "object") throw Error("CERTIFICATE_ASSESSMENT_POLICY_NOT_APPROVED");
  const p = raw as Partial<CertificateAssessmentPolicy>;
  if (p.schemaVersion !== 1 || p.status !== "approved" ||
      p.tenantId !== offering.tenantId || p.programId !== offering.programId ||
      p.offeringId !== offering.offeringId || !validHash(p.curriculumVersionId) ||
      !Number.isInteger(p.minimumScore) || (p.minimumScore ?? 0) < 1 ||
      (p.minimumScore ?? 101) > 100 ||
      !Array.isArray(p.requiredItemIds) || p.requiredItemIds.length < 1 ||
      p.requiredItemIds.length > 100 || p.requiredItemIds.some(id => !validId(id)) ||
      new Set(p.requiredItemIds).size !== p.requiredItemIds.length ||
      !validId(p.authoredBy) || !validId(p.approvedBy) ||
      p.authoredBy === p.approvedBy || !p.approvedAt ||
      !Number.isFinite(Date.parse(p.approvedAt)) || Date.parse(p.approvedAt) > Date.now()) {
    throw Error("CERTIFICATE_ASSESSMENT_POLICY_NOT_APPROVED");
  }
  return p as CertificateAssessmentPolicy;
}

export function requiredCurriculumItems(raw: unknown): CurriculumItem[] {
  if (!raw || typeof raw !== "object") throw Error("CERTIFICATE_CURRICULUM_INVALID");
  const content = raw as { modules?: unknown };
  if (!Array.isArray(content.modules) || content.modules.length < 1 ||
      content.modules.length > 30) throw Error("CERTIFICATE_CURRICULUM_INVALID");
  const items: CurriculumItem[] = [];
  for (const unit of content.modules) {
    if (!unit || typeof unit !== "object") throw Error("CERTIFICATE_CURRICULUM_INVALID");
    const m = unit as { questions?: unknown; exercises?: unknown };
    if (!Array.isArray(m.questions) || !Array.isArray(m.exercises)) {
      throw Error("CERTIFICATE_CURRICULUM_INVALID");
    }
    for (const question of m.questions) {
      if (!question || typeof question !== "object") throw Error("CERTIFICATE_CURRICULUM_INVALID");
      const q = question as Record<string, unknown>;
      if (!validId(q.id) || (q.kind !== "multiple_choice" && q.kind !== "open") ||
          (q.kind === "multiple_choice" && !validId(q.correctChoiceId))) {
        throw Error("CERTIFICATE_CURRICULUM_INVALID");
      }
      items.push({ id: q.id, kind: q.kind, ...(q.kind === "multiple_choice" ?
        { correctChoiceId: q.correctChoiceId as string } : {}) });
    }
    for (const exercise of m.exercises) {
      if (!exercise || typeof exercise !== "object" ||
          !validId((exercise as { id?: unknown }).id)) throw Error("CERTIFICATE_CURRICULUM_INVALID");
      items.push({ id: (exercise as { id: string }).id, kind: "exercise" });
    }
  }
  if (!items.length || items.length > 100 ||
      new Set(items.map(item => item.id)).size !== items.length) {
    throw Error("CERTIFICATE_CURRICULUM_INVALID");
  }
  return items;
}

/**
 * Academic completion can only be certified after every independently approved
 * curriculum assessment has a passing persisted submission in this exact
 * tenant, program and offering. Nothing is inferred from a PAS showcase event,
 * video checkpoint, reflection, coach free-text or client-supplied IDs.
 */
export async function verifyCertificateAssessment(
  firestore: Firestore,
  offering: ProgramOffering,
  learnerUid: string,
): Promise<CertificateAssessmentProof> {
  if (!validHash(offering.offeringId) || !validId(learnerUid)) {
    throw Error("CERTIFICATE_EVIDENCE_SCOPE_INVALID");
  }
  const root = firestore.collection("academicCurricula").doc(offering.offeringId);
  const [policyDoc, headDoc] = await Promise.all([
    firestore.collection("academicCertificatePolicies").doc(offering.offeringId).get(),
    root.get(),
  ]);
  const policy = approvedPolicy(policyDoc.data(), offering);
  const head = headDoc.data();
  if (!headDoc.exists || head?.status !== "published" ||
      head?.tenantId !== offering.tenantId || head?.programId !== offering.programId ||
      head?.publishedVersionId !== policy.curriculumVersionId ||
      !validHash(head?.publishedDigest)) {
    throw Error("CERTIFICATE_PUBLISHED_CURRICULUM_REQUIRED");
  }
  const versionDoc = await root.collection("versions").doc(policy.curriculumVersionId).get();
  const version = versionDoc.data();
  if (!versionDoc.exists || version?.versionId !== policy.curriculumVersionId ||
      version?.tenantId !== offering.tenantId ||
      version?.programId !== offering.programId || version?.offeringId !== offering.offeringId ||
      version?.digest !== head.publishedDigest || !version?.content ||
      typeof version.content !== "object" ||
      sha(JSON.stringify(version.content)) !== version.digest ||
      !validId(version?.submittedBy) || !validId(version?.approvedBy) ||
      version.submittedBy === version.approvedBy ||
      version.submittedBy === policy.approvedBy) {
    throw Error("CERTIFICATE_PUBLISHED_CURRICULUM_REQUIRED");
  }
  const items = requiredCurriculumItems(version.content);
  const byItem = new Map(items.map(item => [item.id, item]));
  if (policy.requiredItemIds.length !== items.length ||
      policy.requiredItemIds.some(id => !byItem.has(id))) {
    throw Error("CERTIFICATE_ASSESSMENT_POLICY_STALE");
  }
  const path = firestore.collection("cohortEvidence").doc(offering.offeringId)
    .collection("learners").doc(learnerUid).collection("submissions");
  const page = await path.limit(101).get();
  if (page.size > 100) throw Error("CERTIFICATE_EVIDENCE_LIMIT");
  const passing = new Map<string, string>();
  for (const doc of page.docs) {
    const row = doc.data() as EvidenceRow;
    const item = byItem.get(String(row.itemId));
    if (!item || row.submissionId !== doc.id ||
        row.tenantId !== offering.tenantId ||
        row.programId !== offering.programId ||
        row.offeringId !== offering.offeringId ||
        row.learnerUid !== learnerUid ||
        row.curriculumVersionId !== policy.curriculumVersionId ||
        row.itemKind !== item.kind || row.consentToCoach !== true ||
        !validId(row.operationId) ||
        sha(JSON.stringify([learnerUid, row.operationId])) !== doc.id) continue;

    let score: number | undefined;
    if (item.kind === "multiple_choice") {
      if (row.status !== "scored" || typeof row.response !== "string") continue;
      const verifiedScore = row.response === item.correctChoiceId ? 100 : 0;
      if (row.score !== verifiedScore) continue;
      score = verifiedScore;
    } else if (row.status === "awaiting_review" && row.score === null) {
      const feedbackSnap = await doc.ref.collection("feedback").doc("current").get();
      const review = feedbackSnap.data();
      if (!feedbackSnap.exists || !validId(review?.reviewerUid) ||
          review.reviewerUid === learnerUid ||
          !Number.isInteger(review.score) || review.score < 0 || review.score > 100 ||
          !Number.isInteger(review.revision) || review.revision < 1 ||
          !validId(review.operationId) ||
          typeof review.reviewedAt !== "string" ||
          !Number.isFinite(Date.parse(review.reviewedAt))) continue;
      score = review.score;
    }
    if (score !== undefined && score >= policy.minimumScore) {
      passing.set(item.id, doc.id);
    }
  }
  if (passing.size !== items.length) {
    throw Error("CERTIFICATE_EVALUATION_NOT_PASSED");
  }
  return {
    policyVersionId: policy.curriculumVersionId,
    policyDigest: sha(JSON.stringify(policy)),
    curriculumDigest: head.publishedDigest as string,
    minimumScore: policy.minimumScore,
    evidenceSubmissionIds: items.map(item => passing.get(item.id)!),
  };
}
