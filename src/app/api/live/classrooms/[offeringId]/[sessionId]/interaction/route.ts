import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningUser } from "@/lib/learning-server";
import { authorizeClassroom, ClassroomError, liveKitConfiguration, roomReference, roomService } from "@/lib/live-classroom-server";
import {
  LIVE_HAND_ATTRIBUTE, MAX_MUTE_ALL_PARTICIPANTS, microphoneTargets, muteTracksBounded,
  parseClassroomInteraction,
} from "@/lib/live-classroom-interaction";
import { ClassroomWebhookBodyTooLarge, readClassroomWebhookBody } from "@/lib/live-classroom-webhook-body";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "private, no-store" };

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status, headers: noStore });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ offeringId: string; sessionId: string }> },
) {
  try {
    // Validate Firebase identity before any privileged provider operation.
    const user = await requireLearningUser(request, { checkRevoked: true });
    // Authenticate first, then reject abusive/malformed client payloads before querying cohort data.
    let parsed: unknown;
    try {
      const raw = await readClassroomWebhookBody(request, 1024);
      parsed = JSON.parse(raw);
    } catch (error) {
      if (error instanceof ClassroomWebhookBodyTooLarge) {
        return json({ error: "invalid_action" }, 413);
      }
      return json({ error: "invalid_action" }, 400);
    }
    const control = parseClassroomInteraction(parsed);
    if (!control) return json({ error: "invalid_action" }, 400);

    const { offeringId, sessionId } = await context.params;
    const classroom = await authorizeClassroom(user, offeringId, sessionId, new Date(), { allowOvertime: true });
    // A configured provider is mandatory. Never return a simulated success.
    const configuration = liveKitConfiguration();
    const service = roomService(configuration);
    const authorizedCollection = roomReference(classroom.roomName).collection("authorized");

    if (control.action === "set_hand") {
      if (classroom.role !== "learner") return json({ error: "learner_only" }, 403);
      // Each user updates their own provider identity, never a client-supplied target ID.
      const roster = authorizedCollection.doc(classroom.identity);
      await firebaseAdminFirestore.runTransaction(async (transaction) => {
        const entry = await transaction.get(roster);
        if (!entry.exists || entry.get("uid") !== user.uid ||
            entry.get("role") !== classroom.role || entry.get("bannedAt")) {
          throw new ClassroomError("classroom_access_revoked", 403);
        }
        const now = Date.now();
        const previous = Date.parse(entry.get("lastHandControlAt") ?? "");
        if (Number.isFinite(previous) && now - previous >= 0 && now - previous < 1500) {
          throw new ClassroomError("classroom_rate_limited", 429);
        }
        transaction.set(roster, { lastHandControlAt: new Date(now).toISOString() }, { merge: true });
      });
      await service.updateParticipant(classroom.roomName, classroom.identity, {
        attributes: { [LIVE_HAND_ATTRIBUTE]: control.raised ? "1" : "" },
      });
      return json({ raised: control.raised });
    }

    if (classroom.role !== "instructor") return json({ error: "instructor_only" }, 403);

    if (control.action === "acknowledge_hand") {
      if (control.identity === classroom.identity) return json({ error: "invalid_action" }, 400);
      const learnerRef = authorizedCollection.doc(control.identity);
      await firebaseAdminFirestore.runTransaction(async (transaction) => {
        const learner = await transaction.get(learnerRef);
        if (!learner.exists || learner.get("role") !== "learner" || learner.get("bannedAt")) {
          throw new ClassroomError("participant_not_found", 404);
        }
        const now = Date.now();
        const previous = Date.parse(learner.get("lastHandAcknowledgedAt") ?? "");
        if (Number.isFinite(previous) && now - previous >= 0 && now - previous < 1500) {
          throw new ClassroomError("classroom_rate_limited", 429);
        }
        transaction.set(learnerRef, { lastHandAcknowledgedAt: new Date(now).toISOString() }, { merge: true });
      });
      const audit = roomReference(classroom.roomName).collection("moderationEvents").doc();
      await audit.create({
        action: "acknowledge_hand", actorUid: user.uid, actorIdentity: classroom.identity,
        targetIdentity: control.identity, status: "pending", requestedAt: new Date().toISOString(),
      });
      try {
        await service.updateParticipant(classroom.roomName, control.identity, {
          attributes: { [LIVE_HAND_ATTRIBUTE]: "" },
        });
      } catch (error) {
        await audit.update({ status: "provider_failed", updatedAt: new Date().toISOString() }).catch(() => {});
        throw error;
      }
      await audit.update({ status: "completed", updatedAt: new Date().toISOString() });
      return json({ acknowledged: true });
    }

    // Group-wide actions can be expensive. Serialize by a distributed room-scoped quota.
    const roomRef = roomReference(classroom.roomName);
    await firebaseAdminFirestore.runTransaction(async (transaction) => {
      const room = await transaction.get(roomRef);
      if (!room.exists || room.get("tenantId") !== classroom.offering.tenantId ||
          room.get("offeringId") !== offeringId || room.get("sessionId") !== sessionId) {
        throw new ClassroomError("classroom_not_found", 404);
      }
      const now = Date.now();
      const previous = Date.parse(room.get("lastMuteAllAt") ?? "");
      if (Number.isFinite(previous) && now - previous >= 0 && now - previous < 15000) {
        throw new ClassroomError("classroom_rate_limited", 429);
      }
      transaction.set(roomRef, { lastMuteAllAt: new Date(now).toISOString() }, { merge: true });
    });
    const participants = await service.listParticipants(classroom.roomName);
    if (participants.length > MAX_MUTE_ALL_PARTICIPANTS) {
      return json({ error: "classroom_exceeds_moderation_limit", maximum: MAX_MUTE_ALL_PARTICIPANTS }, 409);
    }
    const members = participants.filter((person) => /^p_[a-f0-9]{64}$/.test(person.identity));
    const roster = members.length > 0
      ? await firebaseAdminFirestore.getAll(...members.map((person) => authorizedCollection.doc(person.identity)))
      : [];
    const targets = microphoneTargets(members, roster.map((entry) => ({
      identity: entry.id, role: entry.get("role") ?? "", banned: !!entry.get("bannedAt"),
    })));
    const audit = roomRef.collection("moderationEvents").doc();
    await audit.create({
      action: "mute_all", actorUid: user.uid, actorIdentity: classroom.identity,
      targetTracks: targets.length, status: "pending", requestedAt: new Date().toISOString(),
    });
    const result = await muteTracksBounded(targets, (target) =>
      service.mutePublishedTrack(classroom.roomName, target.identity, target.trackSid, true));
    await audit.update({
      status: result.failed === 0 ? "completed" : "partial",
      muted: result.muted, failed: result.failed, updatedAt: new Date().toISOString(),
    });
    return json({
      muted: result.muted, failed: result.failed,
      status: result.failed === 0 ? "completed" : "partial",
      canReenableMicrophones: true,
    }, result.failed === 0 ? 200 : 207);
  } catch (error) {
    if (error instanceof ClassroomError) return json({ error: error.reason }, error.status);
    if ((error instanceof Error && error.message === "AUTH_REQUIRED") ||
        isRejectedFirebaseToken(error)) return json({ error: "authentication_required" }, 401);
    console.error("Classroom educational interaction failed", error instanceof Error ? error.name : "unknown");
    return json({ error: "classroom_control_unavailable" }, 503);
  }
}
