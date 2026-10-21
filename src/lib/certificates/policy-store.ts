import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { requiredCurriculumItems, type CertificateAssessmentPolicy } from "./eligibility";

const digest = (value: unknown) => createHash("sha256")
  .update(JSON.stringify(value)).digest("hex");
const safeId = (x: unknown) => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
const safeHash = (x: unknown) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);

/** Only a different, independent academic approver may authorize the grade policy. */
export function assertCertificatePolicyApprover(
  claims: Record<string, unknown>, tenantId: string,
): void {
  if (claims.superuser === true || claims.role === "superuser") return;
  const assigned = claims.academicApproverTenantIds;
  if ((claims.academicApprover !== true && claims.role !== "academic_approver") ||
      !Array.isArray(assigned) || !assigned.includes(tenantId)) {
    throw Error("CERTIFICATE_POLICY_APPROVER_REQUIRED");
  }
}

/** An immutable approval: cannot silently lower graduation criteria after grading. */
export async function approveCertificateAssessmentPolicy(
  firestore: Firestore, offeringId: string, approverUid: string,
  minimumScore: number, requestId: string,
): Promise<{ policy: CertificateAssessmentPolicy; duplicate: boolean }> {
  if (!safeHash(offeringId) || !safeId(approverUid) ||
      !safeId(requestId) || requestId.length < 20 ||
      !Number.isInteger(minimumScore) || minimumScore < 1 || minimumScore > 100) {
    throw Error("CERTIFICATE_POLICY_INPUT_INVALID");
  }
  const offeringRef = firestore.collection("programOfferings").doc(offeringId);
  const curriculumRef = firestore.collection("academicCurricula").doc(offeringId);
  const policyRef = firestore.collection("academicCertificatePolicies").doc(offeringId);
  return firestore.runTransaction(async tx => {
    const [offeringSnap, headSnap, prior] = await Promise.all([
      tx.get(offeringRef), tx.get(curriculumRef), tx.get(policyRef),
    ]);
    const offering = offeringSnap.data();
    const head = headSnap.data();
    if (!offeringSnap.exists || offering?.offeringId !== offeringId ||
        offering?.status !== "active" || !safeId(offering.tenantId) ||
        !safeId(offering.programId) || !headSnap.exists ||
        head?.tenantId !== offering.tenantId || head?.programId !== offering.programId ||
        head?.status !== "published" || !safeHash(head.publishedVersionId) ||
        !safeHash(head.publishedDigest)) {
      throw Error("CERTIFICATE_PUBLISHED_CURRICULUM_REQUIRED");
    }
    const versionDoc = await tx.get(curriculumRef.collection("versions")
      .doc(head.publishedVersionId));
    const version = versionDoc.data();
    if (!versionDoc.exists || !version || version.versionId !== head.publishedVersionId ||
        version.digest !== head.publishedDigest ||
        !version.content || typeof version.content !== "object" ||
        digest(version.content) !== version.digest ||
        version.tenantId !== offering.tenantId ||
        version.programId !== offering.programId || version.offeringId !== offeringId ||
        !safeId(version.submittedBy) || !safeId(version.approvedBy) ||
        version.submittedBy === version.approvedBy ||
        version.submittedBy === approverUid) {
      throw Error("CERTIFICATE_PUBLISHED_CURRICULUM_REQUIRED");
    }
    const requiredItemIds = requiredCurriculumItems(version.content).map(item => item.id);
    const policy: CertificateAssessmentPolicy = {
      schemaVersion: 1, tenantId: offering.tenantId, programId: offering.programId,
      offeringId, curriculumVersionId: head.publishedVersionId,
      requiredItemIds, minimumScore, status: "approved",
      authoredBy: version.submittedBy, approvedBy: approverUid,
      approvedAt: new Date().toISOString(),
    };
    if (prior.exists) {
      const previous = prior.data() as CertificateAssessmentPolicy;
      if (previous.schemaVersion !== 1 || previous.tenantId !== offering.tenantId ||
          previous.programId !== offering.programId ||
          previous.authoredBy !== version.submittedBy ||
          previous.offeringId !== offeringId || previous.curriculumVersionId !== head.publishedVersionId ||
          previous.minimumScore !== minimumScore || previous.approvedBy !== approverUid ||
          previous.status !== "approved" ||
          JSON.stringify(previous.requiredItemIds) !== JSON.stringify(requiredItemIds)) {
        throw Error("CERTIFICATE_POLICY_ALREADY_APPROVED");
      }
      return { policy: previous, duplicate: true };
    }
    tx.create(policyRef, policy);
    tx.create(policyRef.collection("audit").doc(requestId), {
      action: "independent_assessment_policy_approval", actorUid: approverUid,
      tenantId: offering.tenantId, offeringId, requestId,
      curriculumVersionId: head.publishedVersionId, minimumScore,
      occurredAt: policy.approvedAt,
    });
    return { policy, duplicate: false };
  });
}
