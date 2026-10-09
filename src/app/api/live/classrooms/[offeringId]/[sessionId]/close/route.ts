import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningUser } from "@/lib/learning-server";
import { classroomCloseAvailable, classroomRoomName, resolveClassroomRole, type ClassroomClaims } from "@/lib/live-classroom";
import { ClassroomError, liveKitConfiguration, roomService } from "@/lib/live-classroom-server";
import { programDeliveryStore } from "@/lib/program-delivery-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ offeringId: string; sessionId: string }> },
) {
  try {
    const user = await requireLearningUser(request);
    const { offeringId, sessionId } = await context.params;
    const data = await programDeliveryStore.getClassroomSession(offeringId, sessionId);
    if (!data) return NextResponse.json({ error: "classroom_not_found" }, { status: 404 });
    const role = resolveClassroomRole(user as ClassroomClaims, data.offering, []);
    if (role !== "instructor") {
      return NextResponse.json({ error: "instructor_only" }, { status: 403 });
    }
    if (data.session.classroomProvider !== "livekit" ||
        data.session.status === "cancelled") {
      return NextResponse.json({ error: "classroom_closed" }, { status: 409 });
    }
    if (!classroomCloseAvailable(data.session)) {
      return NextResponse.json({ error: "classroom_not_open" }, { status: 409 });
    }
    // Fail before persisting completion when the media service is not configured.
    const configuration = liveKitConfiguration();
    await programDeliveryStore.completeClassroomSession(offeringId, sessionId);
    const roomName = classroomRoomName(data.offering.tenantId, offeringId, sessionId);
    try {
      await roomService(configuration).deleteRoom(roomName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // A room may already be empty/deleted; the domain transition is idempotent.
      if (!/not found|does not exist|404/i.test(message)) {
        throw new ClassroomError("classroom_close_retryable", 503);
      }
    }
    return NextResponse.json({ closed: true }, { headers: { "Cache-Control": "no-store" } });
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
    console.error("Classroom close failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "classroom_close_unavailable" }, { status: 503 });
  }
}
