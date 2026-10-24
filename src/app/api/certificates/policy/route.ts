import { NextResponse } from "next/server";
import { requireLearningUser } from "@/lib/learning-server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { certificateError } from "@/lib/certificates/http";
import { approveCertificateAssessmentPolicy, assertCertificatePolicyApprover } from "@/lib/certificates/policy-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const approver = await requireLearningUser(request, { checkRevoked: true });
    const payload = await request.json() as {
      offeringId?: unknown; minimumScore?: unknown; requestId?: unknown;
    };
    if (typeof payload.offeringId !== "string" || !/^[a-f0-9]{64}$/.test(payload.offeringId)) {
      throw Error("CERTIFICATE_POLICY_INPUT_INVALID");
    }
    const offeringSnap = await firebaseAdminFirestore.collection("programOfferings")
      .doc(payload.offeringId).get();
    const offering = offeringSnap.data();
    if (!offeringSnap.exists || typeof offering?.tenantId !== "string" ||
        offering.offeringId !== payload.offeringId) throw Error("CERTIFICATE_OFFERING_NOT_FOUND");
    assertCertificatePolicyApprover(approver as Record<string, unknown>, offering.tenantId);
    const result = await approveCertificateAssessmentPolicy(
      firebaseAdminFirestore, payload.offeringId, approver.uid,
      payload.minimumScore as number, payload.requestId as string,
    );
    return NextResponse.json({
      status: result.policy.status, curriculumVersionId: result.policy.curriculumVersionId,
      minimumScore: result.policy.minimumScore,
      requiredItemCount: result.policy.requiredItemIds.length,
      duplicate: result.duplicate,
    }, { status: result.duplicate ? 200 : 201, headers: { "cache-control": "private, no-store" } });
  } catch (error) { return certificateError(error); }
}
