import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningUser } from "@/lib/learning-server";
import { listClassroomAttendance } from "@/lib/live-classroom-attendance";
import { classroomRoomName, resolveClassroomRole, type ClassroomClaims } from "@/lib/live-classroom";
import { programDeliveryStore } from "@/lib/program-delivery-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ offeringId: string; sessionId: string }> },
) {
  try {
    const user = await requireLearningUser(request, { checkRevoked: true });
    const { offeringId, sessionId } = await context.params;
    const data = await programDeliveryStore.getClassroomSession(offeringId, sessionId);
    if (!data || data.session.classroomProvider !== "livekit") {
      return NextResponse.json({ error: "classroom_not_found" }, { status: 404 });
    }
    if (resolveClassroomRole(user as ClassroomClaims, data.offering, []) !== "instructor") {
      return NextResponse.json({ error: "instructor_only" }, { status: 403 });
    }
    const params = new URL(request.url).searchParams;
    const rawLimit = params.get("limit");
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    const cursor = params.get("cursor") ?? undefined;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
        (cursor !== undefined && !/^p_[a-f0-9]{64}$/.test(cursor))) {
      return NextResponse.json({ error: "invalid_attendance_query" }, { status: 400 });
    }
    const roomName = classroomRoomName(data.offering.tenantId, offeringId, sessionId);
    const page = await listClassroomAttendance(roomName, limit, cursor);
    return NextResponse.json({
      ...page,
      sessionId,
      // Signed join/leave events can arrive late; do not equate this with finalized attendance.
      dataStatus: "provisional",
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (message === "CLASSROOM_IDENTIFIERS_INVALID" ||
        message === "CLASSROOM_ATTENDANCE_QUERY_INVALID") {
      return NextResponse.json({ error: "invalid_attendance_query" }, { status: 400 });
    }
    console.error("Classroom attendance query failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "classroom_attendance_unavailable" }, { status: 503 });
  }
}
