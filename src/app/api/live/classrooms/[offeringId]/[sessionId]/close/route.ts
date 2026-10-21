import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningUser } from "@/lib/learning-server";
import { classroomCloseAvailable, classroomRoomName, resolveClassroomRole, type ClassroomClaims } from "@/lib/live-classroom";
import { ClassroomError, liveKitConfiguration, roomService, roomReference } from "@/lib/live-classroom-server";
import {
  closeRevocationTargets, MAX_CLOSE_CREDENTIALS, revokeClassroomJoinTokens,
} from "@/lib/live-classroom-close";
import { programDeliveryStore } from "@/lib/program-delivery-server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ offeringId: string; sessionId: string }> },
) {
  try {
    const user = await requireLearningUser(request, { checkRevoked: true });
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
    // Complete the business session before provider calls so LUMA denies all
    // *new* roomJoin tokens during closure/retry, even if Cloud is slow.
    await programDeliveryStore.completeClassroomSession(offeringId, sessionId);
    const roomName = classroomRoomName(data.offering.tenantId, offeringId, sessionId);
    const service = roomService(configuration);
    const roomRef = roomReference(roomName);
    try {
      const localRoom = await roomRef.get();
      if (!localRoom.get("closeTokensRevokedAt")) {
        // A disconnected participant can retain a previously issued JWT.
        // The Firestore roster is authoritative for every token issuance,
        // and the connected provider roster covers legacy/migrated records.
        const issued = await roomRef.collection("authorized")
          .limit(MAX_CLOSE_CREDENTIALS + 1).get();
        if (issued.size > MAX_CLOSE_CREDENTIALS) {
          throw new Error("CLASSROOM_CLOSE_IDENTITY_LIMIT");
        }
        let connected: Array<{ identity: string }> = [];
        try {
          connected = await service.listParticipants(roomName);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!/room.*not found|requested room does not exist|404/i.test(message)) {
            throw error;
          }
        }
        const identities = closeRevocationTargets(
          issued.docs.map((document) => document.id),
          connected.map((participant) => participant.identity),
        );
        if (identities.length > 0) {
          await revokeClassroomJoinTokens(service, roomName, identities);
        }
        // This fence is persisted only after every provider revocation passed.
        // Retried close requests may proceed directly to DeleteRoom.
        await roomRef.set({
          tenantId: data.offering.tenantId,
          programId: data.offering.programId,
          offeringId, sessionId,
          recordingPolicy: data.session.recordingPolicy,
          closeTokensRevokedAt: new Date().toISOString(),
          closeTokensRevokedCount: identities.length,
        }, { merge: true });
      }
      await service.deleteRoom(roomName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Room deletion is idempotent after the credential fence, but any
      // unknown service failure is retryable, never a fictitious success.
      if (!/room.*not found|requested room does not exist|404/i.test(message)) {
        throw new ClassroomError("classroom_close_retryable", 503);
      }
      const fence = await roomRef.get();
      if (!fence.get("closeTokensRevokedAt")) {
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
