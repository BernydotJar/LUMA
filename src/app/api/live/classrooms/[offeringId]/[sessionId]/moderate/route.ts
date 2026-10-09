import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningUser } from "@/lib/learning-server";
import { authorizeClassroom, ClassroomError, liveKitConfiguration, roomReference, roomService } from "@/lib/live-classroom-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ offeringId: string; sessionId: string }> },
) {
  try {
    const user = await requireLearningUser(request);
    const { offeringId, sessionId } = await context.params;
    const classroom = await authorizeClassroom(user, offeringId, sessionId);
    if (classroom.role !== "instructor") {
      return NextResponse.json({ error: "instructor_only" }, { status: 403 });
    }
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    const { action, identity } = body as Record<string, unknown>;
    if (action !== "remove" || typeof identity !== "string" ||
        !/^p_[a-f0-9]{64}$/.test(identity) || identity === classroom.identity) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    const rosterRef = roomReference(classroom.roomName)
      .collection("authorized").doc(identity);
    const authorized = await rosterRef.get();
    if (!authorized.exists || authorized.get("role") !== "learner") {
      return NextResponse.json({ error: "participant_not_found" }, { status: 404 });
    }
    const configuration = liveKitConfiguration();
    // Persist the restriction before disconnecting; never mint replacement tokens.
    const removedAt = new Date().toISOString();
    await rosterRef.set({
      bannedAt: removedAt,
      bannedBy: classroom.uid,
    }, { merge: true });
    // LiveKit Cloud also invalidates previously-issued media tokens.
    await roomService(configuration).removeParticipant(classroom.roomName, identity, {
      // Move cutoff one second ahead: a token issued in the same second is also revoked.
      revokeTokenTs: BigInt(Math.floor(Date.now() / 1000) + 1),
    });
    return NextResponse.json({ removed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ClassroomError) {
      return NextResponse.json({ error: error.reason }, { status: error.status });
    }
    if ((error instanceof Error && error.message === "AUTH_REQUIRED") ||
        isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    console.error("Classroom moderation failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "moderation_unavailable" }, { status: 503 });
  }
}
