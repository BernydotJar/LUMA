import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningUser } from "@/lib/learning-server";
import { authorizeClassroom, ClassroomError, createClassroomToken } from "@/lib/live-classroom-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ offeringId: string; sessionId: string }> },
) {
  try {
    const user = await requireLearningUser(request, { checkRevoked: true });
    const { offeringId, sessionId } = await context.params;
    const classroom = await authorizeClassroom(user, offeringId, sessionId);
    const credentials = await createClassroomToken(classroom);
    return NextResponse.json({
      ...credentials,
      classroom: {
        title: classroom.session.title,
        offeringTitle: classroom.offering.title,
        scheduledAt: classroom.session.startsAt,
        durationMinutes: classroom.session.durationMinutes,
        recordingPolicy: classroom.session.recordingPolicy,
      },
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    if (error instanceof ClassroomError) {
      return NextResponse.json({ error: error.reason }, { status: error.status });
    }
    if ((error instanceof Error && error.message === "AUTH_REQUIRED") ||
        isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "CLASSROOM_IDENTIFIERS_INVALID") {
      return NextResponse.json({ error: "invalid_classroom_request" }, { status: 400 });
    }
    console.error("Classroom token issuance failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "classroom_unavailable" }, { status: 503 });
  }
}
