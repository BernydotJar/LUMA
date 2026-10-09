import { FieldPath } from "firebase-admin/firestore";
import { firebaseAdminFirestore } from "./firebase-admin";
import { summarizeClassroomPresence, type ClassroomPresenceEvent, type LiveClassroomEventType } from "./live-classroom";
import { roomReference } from "./live-classroom-server";

export interface SignedClassroomEvent {
  id: string;
  type: LiveClassroomEventType;
  roomName: string;
  identity: string;
  atSeconds: number;
}

/** Reconcile only previously admitted identities, not arbitrary signed media events. */
export async function recordClassroomPresence(event: SignedClassroomEvent): Promise<void> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(event.id) ||
      !/^luma_[a-f0-9]{64}$/.test(event.roomName) ||
      !/^p_[a-f0-9]{64}$/.test(event.identity) ||
      !Number.isFinite(event.atSeconds) || event.atSeconds < 0) {
    throw new Error("CLASSROOM_EVENT_INVALID");
  }
  const room = roomReference(event.roomName);
  const authorized = await room.collection("authorized").doc(event.identity).get();
  if (!authorized.exists) return;
  const uid = authorized.get("uid");
  if (typeof uid !== "string" || !uid) throw new Error("CLASSROOM_ROSTER_INVALID");

  const participant = room.collection("attendance").doc(event.identity);
  const events = participant.collection("events");
  const eventRef = events.doc(event.id);
  await firebaseAdminFirestore.runTransaction(async (transaction) => {
    const [previousEvent, previousEvents] = await Promise.all([
      transaction.get(eventRef),
      transaction.get(events),
    ]);
    if (previousEvent.exists) return;
    const sequence: ClassroomPresenceEvent[] = previousEvents.docs.map(
      (document) => document.data() as ClassroomPresenceEvent,
    );
    sequence.push({ id: event.id, type: event.type, atSeconds: event.atSeconds });
    const summary = summarizeClassroomPresence(sequence);
    transaction.create(eventRef, { id: event.id, type: event.type, atSeconds: event.atSeconds });
    transaction.set(participant, {
      uid, role: authorized.get("role"), ...summary, updatedAt: new Date().toISOString(),
    }, { merge: true });
  });
}


export interface ClassroomAttendanceRow {
  participantId: string;
  displayName: string;
  role: "learner" | "instructor";
  attendedSeconds: number;
  connectionCount: number;
  firstJoinedAt: string | null;
  lastLeftAt: string | null;
  connected: boolean;
  /** Provider webhooks are at-least-once; unclosed intervals are provisional. */
  finalized: false;
}

export async function listClassroomAttendance(
  roomName: string,
  limit = 50,
  cursor?: string,
): Promise<{ attendees: ClassroomAttendanceRow[]; nextCursor: string | null }> {
  if (!/^luma_[a-f0-9]{64}$/.test(roomName) ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      (cursor !== undefined && !/^p_[a-f0-9]{64}$/.test(cursor))) {
    throw new Error("CLASSROOM_ATTENDANCE_QUERY_INVALID");
  }
  const room = roomReference(roomName);
  let query = room.collection("attendance")
    .orderBy(FieldPath.documentId())
    .limit(limit + 1);
  if (cursor) query = query.startAfter(cursor);
  const snapshot = await query.get();
  const page = snapshot.docs.slice(0, limit);
  const roster = await Promise.all(page.map((row) =>
    room.collection("authorized").doc(row.id).get(),
  ));
  const attendees: ClassroomAttendanceRow[] = page.map((row, index) => {
    const data = row.data();
    const authorized = roster[index].data();
    return {
      participantId: row.id,
      displayName: typeof authorized?.displayName === "string"
        ? authorized.displayName.slice(0, 80) : "Participante",
      role: authorized?.role === "instructor" ? "instructor" : "learner",
      attendedSeconds: Number.isFinite(data.attendedSeconds)
        ? Math.max(0, data.attendedSeconds) : 0,
      connectionCount: Number.isFinite(data.connectionCount)
        ? Math.max(0, data.connectionCount) : 0,
      firstJoinedAt: typeof data.firstJoinedAt === "string" ? data.firstJoinedAt : null,
      lastLeftAt: typeof data.lastLeftAt === "string" ? data.lastLeftAt : null,
      connected: data.connected === true,
      finalized: false,
    };
  });
  return {
    attendees,
    nextCursor: snapshot.docs.length > limit && page.length
      ? page[page.length - 1].id : null,
  };
}
