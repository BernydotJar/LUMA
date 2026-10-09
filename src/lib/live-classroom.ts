import { createHash } from "node:crypto";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";
import { isActiveCommerceEnrollment } from "./commerce/enrollment";
import type { LiveProgramSession, ProgramOffering } from "./program-delivery";

export type LiveClassroomRole = "instructor" | "learner";
export type LiveClassroomEventType = "participant_joined" | "participant_left";

export interface ClassroomClaims {
  uid: string;
  role?: unknown;
  admin?: unknown;
  superuser?: unknown;
  coach?: unknown;
  name?: unknown;
}

export interface ClassroomPresenceEvent {
  id: string;
  type: LiveClassroomEventType;
  atSeconds: number;
}

export interface ClassroomPresenceSummary {
  attendedSeconds: number;
  firstJoinedAt: string | null;
  lastLeftAt: string | null;
  openIntervalAt: string | null;
  connectionCount: number;
  connected: boolean;
}

/** The media provider never owns a LUMA offering, session or entitlement. */
export function isLiveKitClassroom(session: LiveProgramSession): boolean {
  return session.classroomProvider === "livekit";
}

export function classroomRoomName(
  tenantId: string,
  offeringId: string,
  sessionId: string,
): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([tenantId, offeringId, sessionId]))
    .digest("hex");
  return `luma_${digest}`;
}

/** Opaque and scoped to one room: never put an email or a Firebase UID in media identity. */
export function classroomParticipantId(roomName: string, uid: string): string {
  return `p_${createHash("sha256").update(JSON.stringify([roomName, uid])).digest("hex")}`;
}

export function classroomCapacity(session: LiveProgramSession): number {
  const capacity = session.classroomCapacity ?? 120;
  if (!Number.isInteger(capacity) || capacity < 2 || capacity > 1000) {
    throw new Error("CLASSROOM_CAPACITY_INVALID");
  }
  return capacity;
}

export function classroomAdmission(
  offering: ProgramOffering,
  session: LiveProgramSession,
  nowMs = Date.now(),
): "allowed" | "not_open" | "closed" {
  if (
    offering.status !== "active" ||
    !["live", "hybrid"].includes(offering.deliveryMode) ||
    session.status !== "scheduled" ||
    !isLiveKitClassroom(session)
  ) {
    return "closed";
  }
  const start = Date.parse(session.startsAt);
  if (!Number.isFinite(start) || !Number.isFinite(session.durationMinutes)) {
    return "closed";
  }
  if (nowMs < start - 30 * 60_000) return "not_open";
  if (nowMs > start + session.durationMinutes * 60_000 + 30 * 60_000) {
    return "closed";
  }
  return "allowed";
}

/** Deny by default. Cohort and tenant must BOTH match the paid enrollment. */
export function resolveClassroomRole(
  claims: ClassroomClaims,
  offering: ProgramOffering,
  enrollments: readonly CommerceEnrollmentRecord[],
  now = new Date().toISOString(),
): LiveClassroomRole | null {
  const role = typeof claims.role === "string" ? claims.role : "";
  if (
    claims.admin === true ||
    claims.superuser === true ||
    role === "admin" ||
    role === "superuser"
  ) {
    return "instructor";
  }
  if (
    offering.coachIds.includes(claims.uid) &&
    (claims.coach === true || role === "coach")
  ) {
    return "instructor";
  }
  return enrollments.some(
    (item) =>
      item.learnerId === claims.uid &&
      item.tenantId === offering.tenantId &&
      item.programId === offering.programId &&
      item.offeringId === offering.offeringId &&
      isActiveCommerceEnrollment(item, now),
  )
    ? "learner"
    : null;
}

export function classroomDisplayName(claims: ClassroomClaims, role: LiveClassroomRole): string {
  const name = typeof claims.name === "string" ? claims.name.trim() : "";
  return name && name.length <= 80 && !/[\x00-\x1f]/.test(name)
    ? name
    : role === "instructor" ? "Entrenador" : "Participante";
}

/** Event-time reconciliation is stable under retries and out-of-order webhook delivery. */
export function summarizeClassroomPresence(
  events: readonly ClassroomPresenceEvent[],
): ClassroomPresenceSummary {
  const sorted = [...events]
    .filter((event) =>
      Number.isFinite(event.atSeconds) &&
      (event.type === "participant_joined" || event.type === "participant_left"))
    .sort((a, b) =>
      a.atSeconds - b.atSeconds ||
      (a.type === b.type ? a.id.localeCompare(b.id) : a.type === "participant_joined" ? -1 : 1));
  let open: number | null = null;
  let total = 0;
  let count = 0;
  let first: number | null = null;
  let last: number | null = null;
  for (const event of sorted) {
    if (event.type === "participant_joined" && open === null) {
      open = event.atSeconds;
      count += 1;
      first ??= event.atSeconds;
    } else if (event.type === "participant_left" && open !== null) {
      total += Math.max(0, event.atSeconds - open);
      last = event.atSeconds;
      open = null;
    }
  }
  return {
    attendedSeconds: Math.round(total),
    connectionCount: count,
    firstJoinedAt: first === null ? null : new Date(first * 1000).toISOString(),
    lastLeftAt: last === null ? null : new Date(last * 1000).toISOString(),
    openIntervalAt: open === null ? null : new Date(open * 1000).toISOString(),
    connected: open !== null,
  };
}
