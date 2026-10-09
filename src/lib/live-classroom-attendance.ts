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
