import { RoomServiceClient } from "livekit-server-sdk";
import type { DecodedIdToken } from "firebase-admin/auth";
import { firebaseAdminFirestore } from "./firebase-admin";
import { commerceEnrollments } from "./commerce/server";
import { programDeliveryStore } from "./program-delivery-server";
import {
  classroomAdmission,
  classroomCapacity,
  classroomDisplayName,
  classroomParticipantId,
  classroomRoomName,
  resolveClassroomRole,
  reserveClassroomTokenQuota,
  type ClassroomClaims,
  type LiveClassroomRole,
} from "./live-classroom";
import type { LiveProgramSession, ProgramOffering } from "./program-delivery";
import { signClassroomJoinToken } from "./live-classroom-token";

export class ClassroomError extends Error {
  constructor(readonly reason: string, readonly status: number) {
    super(reason);
  }
}

export interface LiveKitConfiguration {
  serverUrl: string;
  httpUrl: string;
  apiKey: string;
  apiSecret: string;
}

export function liveKitConfiguration(): LiveKitConfiguration {
  if (process.env.LUMA_LIVE_CLASSROOM_ENABLED !== "true") {
    throw new ClassroomError("classroom_not_enabled", 503);
  }
  const serverUrl = process.env.LIVEKIT_URL?.trim() ?? "";
  const apiKey = process.env.LIVEKIT_API_KEY?.trim() ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim() ?? "";
  let url: URL;
  try {
    url = new URL(serverUrl);
  } catch {
    throw new ClassroomError("classroom_provider_unconfigured", 503);
  }
  if (url.protocol !== "wss:" || !url.hostname || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/" || !apiKey || !apiSecret) {
    throw new ClassroomError("classroom_provider_unconfigured", 503);
  }
  url.protocol = "https:";
  return { serverUrl, httpUrl: url.toString(), apiKey, apiSecret };
}

export function roomService(configuration: LiveKitConfiguration): RoomServiceClient {
  return new RoomServiceClient(
    configuration.httpUrl,
    configuration.apiKey,
    configuration.apiSecret,
  );
}

export interface AuthorizedClassroom {
  offering: ProgramOffering;
  session: LiveProgramSession;
  roomName: string;
  identity: string;
  role: LiveClassroomRole;
  displayName: string;
  uid: string;
  maxParticipants: number;
}

export async function authorizeClassroom(
  user: DecodedIdToken,
  offeringId: string,
  sessionId: string,
  now = new Date(),
): Promise<AuthorizedClassroom> {
  const data = await programDeliveryStore.getClassroomSession(offeringId, sessionId);
  if (!data) throw new ClassroomError("classroom_not_found", 404);
  const { offering, session } = data;

  // Resolve the learner entitlement BEFORE disclosing session timing or provider details.
  let enrollments = await commerceEnrollments.listByLearner(user.uid);
  let role = resolveClassroomRole(user as ClassroomClaims, offering, enrollments, now.toISOString());
  if (!role && user.email && user.email_verified === true) {
    try {
      await commerceEnrollments.claimByEmail(user.uid, user.email.trim().toLowerCase());
      enrollments = await commerceEnrollments.listByLearner(user.uid);
      role = resolveClassroomRole(user as ClassroomClaims, offering, enrollments, now.toISOString());
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "ENROLLMENT_ALREADY_CLAIMED") throw error;
    }
  }
  if (!role) throw new ClassroomError("classroom_access_denied", 403);

  const admission = classroomAdmission(offering, session, now.getTime());
  if (admission === "closed") throw new ClassroomError("classroom_closed", 409);
  if (admission === "not_open") throw new ClassroomError("classroom_not_open", 409);

  const roomName = classroomRoomName(offering.tenantId, offeringId, sessionId);
  return {
    offering, session, roomName,
    identity: classroomParticipantId(roomName, user.uid),
    displayName: classroomDisplayName(user as ClassroomClaims, role),
    role, uid: user.uid, maxParticipants: classroomCapacity(session),
  };
}

export function roomReference(roomName: string) {
  return firebaseAdminFirestore.collection("liveClassroomRooms").doc(roomName);
}

/** Idempotent mapping: webhooks never infer a tenant from mutable room metadata. */
async function registerRoom(classroom: AuthorizedClassroom): Promise<void> {
  const ref = roomReference(classroom.roomName);
  await firebaseAdminFirestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const current = snapshot.data();
      if (current?.tenantId !== classroom.offering.tenantId ||
          current?.offeringId !== classroom.offering.offeringId ||
          current?.sessionId !== classroom.session.sessionId) {
        throw new ClassroomError("classroom_identity_conflict", 409);
      }
      return;
    }
    transaction.create(ref, {
      tenantId: classroom.offering.tenantId,
      programId: classroom.offering.programId,
      offeringId: classroom.offering.offeringId,
      sessionId: classroom.session.sessionId,
      recordingPolicy: classroom.session.recordingPolicy,
      createdAt: new Date().toISOString(),
    });
  });
}

export async function createClassroomToken(
  classroom: AuthorizedClassroom,
): Promise<{ serverUrl: string; token: string; role: LiveClassroomRole }> {
  const configuration = liveKitConfiguration();
  await registerRoom(classroom);
  const rosterRef = roomReference(classroom.roomName)
    .collection("authorized").doc(classroom.identity);
  // Atomic and tenant-scoped. No client can bypass this distributed issuance budget.
  await firebaseAdminFirestore.runTransaction(async (transaction) => {
    const current = await transaction.get(rosterRef);
    if (current.get("bannedAt")) {
      throw new ClassroomError("classroom_access_revoked", 403);
    }
    const quota = reserveClassroomTokenQuota(current.exists ? current.data() : undefined);
    if (!quota) throw new ClassroomError("classroom_rate_limited", 429);
    transaction.set(rosterRef, {
      uid: classroom.uid,
      role: classroom.role,
      displayName: classroom.displayName,
      ...quota,
      issuedAt: quota.lastIssuedAt,
    }, { merge: true });
  });
  const service = roomService(configuration);
  try {
    await service.createRoom({
      name: classroom.roomName,
      maxParticipants: classroom.maxParticipants,
      emptyTimeout: 30 * 60,
      metadata: JSON.stringify({
        offeringId: classroom.offering.offeringId,
        sessionId: classroom.session.sessionId,
        recordingPolicy: classroom.session.recordingPolicy,
      }),
    });
  } catch (error) {
    // Multiple authenticated users may open the same class concurrently.
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists|ALREADY_EXISTS/i.test(message)) {
      throw new ClassroomError("classroom_provider_unavailable", 503);
    }
  }

  // Race guard: moderator may have banned this identity while the provider room was created.
  const latestRoster = await rosterRef.get();
  if (latestRoster.get("bannedAt")) {
    throw new ClassroomError("classroom_access_revoked", 403);
  }

  const token = await signClassroomJoinToken({
    apiKey: configuration.apiKey,
    apiSecret: configuration.apiSecret,
    roomName: classroom.roomName,
    identity: classroom.identity,
    displayName: classroom.displayName,
    role: classroom.role,
  });
  if ((await rosterRef.get()).get("bannedAt")) {
    throw new ClassroomError("classroom_access_revoked", 403);
  }
  return { serverUrl: configuration.serverUrl, token, role: classroom.role };
}
