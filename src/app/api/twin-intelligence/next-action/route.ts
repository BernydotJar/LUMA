import { NextResponse } from "next/server";
import { requireLearningUser, learningStoreForScope } from "@/lib/learning-server";
import { requireLearningEntitlement } from "@/lib/learning-entitlement-server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { assertTwinPilotScope, decideTwinLearningMove } from "@/lib/twin-intelligence/contracts";
import { TeachingTwinStore } from "@/lib/twin-intelligence/teaching-store";
import { pilotError } from "@/lib/twin-intelligence/server";

export const runtime = "nodejs";

/**
 * Learners can only request their own existing server-side projection.
 * No arbitrary learner ID or tenant ID is accepted from the client.
 * This route is read-only: the decision cannot mutate mastery/certification.
 */
export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request, { checkRevoked: true });
    const scope = await requireLearningEntitlement(user, request.headers.get("x-luma-program-id"));
    assertTwinPilotScope(scope);
    const [learnerResult, teacher] = await Promise.all([
      learningStoreForScope(scope).get(user.uid),
      new TeachingTwinStore(firebaseAdminFirestore).readApproved(scope),
    ]);
    if (!learnerResult) {
      return NextResponse.json({ error: "learner_state_not_found" }, { status: 404 });
    }
    if (!teacher || teacher.teacherUid !== process.env.LUMA_TWIN_PILOT_TEACHER_UID) {
      return NextResponse.json({ error: "teacher_approval_required" }, { status: 409 });
    }
    const recommendation = decideTwinLearningMove({
      learner: learnerResult.record.state,
      learnerProjectionVersion: learnerResult.record.version,
      action: learnerResult.plan.nextAction,
      teacher,
    });
    return NextResponse.json({
      recommendation,
      authority: { teacherApproved: true, generatedBy: "deterministic-pilot-v1",
        generativeAiUsed: false, studentMasteryUnchanged: true },
    });
  } catch (error) { return pilotError(error); }
}
