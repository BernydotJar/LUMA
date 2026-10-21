import { createHash, randomUUID } from "node:crypto";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import type { ProgramOffering } from "@/lib/program-delivery";
import { verifyCertificateAssessment } from "./eligibility";
import { approveCertificateAssessmentPolicy, assertCertificatePolicyApprover } from "./policy-store";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST) &&
  (process.env.GCLOUD_PROJECT ?? "demo-luma-certificate-acceptance").startsWith("demo-");
const app = enabled ? initializeApp({
  projectId: process.env.GCLOUD_PROJECT || "demo-luma-certificate-acceptance",
}, "certificate-grade-gate-" + randomUUID()) : undefined;
const db = app ? getFirestore(app) : undefined;
const hash = (x: string) => createHash("sha256").update(x).digest("hex");
const offeringId = hash("academic-certificate-offering");
const versionId = hash("independently-approved-curriculum");
const learnerId = "graduate-" + randomUUID().slice(0, 12);
const otherLearnerId = "foreign-" + randomUUID().slice(0, 12);
const offering: ProgramOffering = {
  offeringId, tenantId: "qa-academy", programId: "qa-leadership",
  cohortKey: "2026-oct", title: "Academic Trust Program", deliveryMode: "hybrid",
  timezone: "America/Guatemala", status: "active", coachIds: ["coach-verified"],
  createdAt: "2026-10-16T10:00:00Z", updatedAt: "2026-10-18T10:00:00Z",
};
const content = { modules: [{
  id: "module-one", lessons: [{ id: "lesson-one", title: "Ethics" }],
  questions: [{ id: "question-one", kind: "multiple_choice", correctChoiceId: "correct",
    choices: [{ id: "correct", label: "Yes" }, { id: "incorrect", label: "No" }] }],
  exercises: [{ id: "exercise-one", prompt: "Apply judgement" }],
}] };
const digest = hash(JSON.stringify(content));
const base = () => db!.collection("cohortEvidence").doc(offeringId)
  .collection("learners").doc(learnerId).collection("submissions");
const submission = (requestId: string, itemId: string, kind: string,
  response: string, score: number | null, status: string) => ({
  submissionId: hash(JSON.stringify([learnerId, requestId])),
  tenantId: offering.tenantId, programId: offering.programId, offeringId,
  learnerUid: learnerId, curriculumVersionId: versionId,
  itemId, itemKind: kind, response, score, status,
  operationId: requestId, consentToCoach: true,
});

async function seed() {
  await Promise.all([
    db!.collection("programOfferings").doc(offeringId).set(offering),
    db!.collection("academicCurricula").doc(offeringId).set({
      tenantId: offering.tenantId, programId: offering.programId,
      status: "published", publishedDigest: digest, publishedVersionId: versionId,
    }),
    db!.collection("academicCurricula").doc(offeringId)
      .collection("versions").doc(versionId).set({
        versionId, tenantId: offering.tenantId, programId: offering.programId, offeringId,
        digest, content, submittedBy: "author-one", approvedBy: "reviewer-curriculum",
      }),
  ]);
  const policy = await approveCertificateAssessmentPolicy(
    db!, offeringId, "reviewer-certification", 80, "qa-policy-approval-123456789");
  if (policy.duplicate || policy.policy.requiredItemIds.length !== 2) {
    throw Error("CERTIFICATE_POLICY_SEED_FAILED");
  }
  const question = submission("qa-question-attempt-123456789", "question-one",
    "multiple_choice", "correct", 100, "scored");
  const exercise = submission("qa-exercise-attempt-123456789", "exercise-one",
    "exercise", "Demonstrated reasoned application after the academic session", null,
    "awaiting_review");
  await Promise.all([
    base().doc(question.submissionId).set(question),
    base().doc(exercise.submissionId).set(exercise),
  ]);
  await base().doc(exercise.submissionId).collection("feedback")
    .doc("current").set({
      reviewerUid: "coach-verified", score: 90, revision: 1,
      reviewedAt: "2026-10-19T12:00:00Z",
      operationId: "qa-independent-feedback-1234567",
    });
  return { question, exercise };
}

describe.runIf(enabled)("Firestore enrolled-cohort graduation eligibility", () => {
  afterAll(async () => { if (app) await deleteApp(app); });

  it("requires matching independent policy, complete passing submissions and coach review", async () => {
    const { question, exercise } = await seed();
    expect(() => assertCertificatePolicyApprover({
      role: "academic_approver", academicApproverTenantIds: ["foreign-academy"],
    }, offering.tenantId)).toThrow("CERTIFICATE_POLICY_APPROVER_REQUIRED");
    expect(() => assertCertificatePolicyApprover({
      role: "academic_approver", academicApproverTenantIds: ["qa-academy"],
    }, offering.tenantId)).not.toThrow();
    const receipt = await db!.collection("academicCertificatePolicies").doc(offeringId)
      .collection("audit").doc("qa-policy-approval-123456789").get();
    expect(receipt.exists).toBe(true);
    const repeated = await approveCertificateAssessmentPolicy(
      db!, offeringId, "reviewer-certification", 80, "qa-policy-approval-123456789");
    expect(repeated.duplicate).toBe(true);
    await expect(approveCertificateAssessmentPolicy(
      db!, offeringId, "reviewer-certification", 50, "qa-policy-reduction-123456789"))
      .rejects.toThrow("CERTIFICATE_POLICY_ALREADY_APPROVED");
    const proof = await verifyCertificateAssessment(db!, offering, learnerId);
    expect(proof.evidenceSubmissionIds).toEqual([question.submissionId, exercise.submissionId]);
    expect(proof.minimumScore).toBe(80);
    expect(proof.curriculumDigest).toBe(digest);
    await expect(verifyCertificateAssessment(db!, offering, otherLearnerId))
      .rejects.toThrow("CERTIFICATE_EVALUATION_NOT_PASSED");
    await expect(verifyCertificateAssessment(db!, { ...offering, tenantId: "foreign-academy" }, learnerId))
      .rejects.toThrow("CERTIFICATE_ASSESSMENT_POLICY_NOT_APPROVED");
    const feedback = base().doc(exercise.submissionId).collection("feedback").doc("current");
    await feedback.update({ score: 75 });
    await expect(verifyCertificateAssessment(db!, offering, learnerId))
      .rejects.toThrow("CERTIFICATE_EVALUATION_NOT_PASSED");
    await feedback.update({ score: 90 });
    await db!.collection("academicCertificatePolicies").doc(offeringId).update({ status: "withdrawn" });
    await expect(verifyCertificateAssessment(db!, offering, learnerId))
      .rejects.toThrow("CERTIFICATE_ASSESSMENT_POLICY_NOT_APPROVED");
  });
});
