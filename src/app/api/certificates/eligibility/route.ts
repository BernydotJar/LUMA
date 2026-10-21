import { NextResponse } from "next/server";
import { requireLearningCoachAccess } from "@/lib/learning-server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { certificates } from "@/lib/certificates/server";
import { assertCertificateTenantAccess } from "@/lib/certificates/authorization";
import { certificateError } from "@/lib/certificates/http";
import { documentId } from "@/lib/certificates/domain";
import { verifyCertificateAssessment } from "@/lib/certificates/eligibility";
import { commerceEnrollments } from "@/lib/commerce/server";
import { isActiveCommerceEnrollment } from "@/lib/commerce/enrollment";

export const runtime = "nodejs";

/** A coach cannot approve a completion until the specific cohort has a complete graded rubric. */
export async function GET(request: Request) {
  try {
    const { decoded, access } = await requireLearningCoachAccess(request);
    const params = new URL(request.url).searchParams;
    const offeringId = documentId(params.get("offeringId"), "offering_id");
    const learnerId = documentId(params.get("learnerId"), "learner_id");
    const offering = await certificates.authorizedOffering(
      { uid: decoded.uid, access }, offeringId, learnerId);
    assertCertificateTenantAccess(decoded as Record<string, unknown>, offering.tenantId);
    const enrollments = await commerceEnrollments.listByLearner(learnerId);
    if (!enrollments.some(e => e.tenantId === offering.tenantId &&
        e.programId === offering.programId && e.offeringId === offeringId &&
        isActiveCommerceEnrollment(e))) {
      throw new Error("CERTIFICATE_ENROLLMENT_REQUIRED");
    }
    const proof = await verifyCertificateAssessment(firebaseAdminFirestore, offering, learnerId);
    return NextResponse.json({
      eligible: true,
      curriculumVersionId: proof.policyVersionId,
      assessmentCount: proof.evidenceSubmissionIds.length,
      minimumScore: proof.minimumScore,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return certificateError(error); }
}
