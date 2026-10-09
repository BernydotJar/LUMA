import { createHash } from "node:crypto";
import { FieldPath, type Firestore } from "firebase-admin/firestore";

export type ProgramDeliveryMode = "asynchronous" | "live" | "hybrid";
export type ProgramOfferingStatus = "draft" | "active" | "completed" | "archived";
export type LiveSessionStatus = "scheduled" | "completed" | "cancelled";
export type RecordingPolicy = "none" | "optional" | "available_after_session";

export interface ProgramOffering {
  offeringId: string;
  tenantId: string;
  programId: string;
  cohortKey: string;
  title: string;
  deliveryMode: ProgramDeliveryMode;
  timezone: string;
  status: ProgramOfferingStatus;
  coachIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProgramOfferingInput {
  tenantId: string;
  programId: string;
  cohortKey: string;
  title: string;
  deliveryMode: ProgramDeliveryMode;
  timezone: string;
  status?: ProgramOfferingStatus;
  coachIds?: string[];
}


export interface ProgramAccess {
  tenantId: string;
  programId: string;
  offeringId: string;
}

export interface LiveProgramSession {
  sessionId: string;
  offeringId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  joinUrl?: string;
  recordingPolicy: RecordingPolicy;
  status: LiveSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LiveProgramSessionPage {
  sessions: LiveProgramSession[];
  nextCursor: string | null;
}

function decodeSessionCursor(cursor: string): [string, string] {
  if (!/^[A-Za-z0-9_-]{1,1024}$/.test(cursor)) {
    throw new Error("PROGRAM_SESSION_CURSOR_INVALID");
  }
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!Array.isArray(value) || value.length !== 2 ||
        typeof value[0] !== "string" || typeof value[1] !== "string" ||
        value[0] !== validIso(value[0], "cursor.startsAt") ||
        !value[1].trim() || value[1].length > 128 || value[1].includes("/")) {
      throw new Error("PROGRAM_SESSION_CURSOR_INVALID");
    }
    return [value[0], value[1]];
  } catch {
    throw new Error("PROGRAM_SESSION_CURSOR_INVALID");
  }
}

export interface LiveProgramSessionInput {
  sessionId?: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  joinUrl?: string;
  recordingPolicy?: RecordingPolicy;
  status?: LiveSessionStatus;
}

function required(value: string, label: string, max = 180): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new Error(`${label} must be 1-${max} characters`);
  }
  return normalized;
}

function validIso(value: string, label: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return new Date(parsed).toISOString();
}

function offeringId(input: Pick<ProgramOfferingInput, "tenantId" | "programId" | "cohortKey">) {
  return createHash("sha256")
    .update(JSON.stringify([
      required(input.tenantId, "tenantId"),
      required(input.programId, "programId"),
      required(input.cohortKey, "cohortKey"),
    ]))
    .digest("hex");
}

function sessionId(input: LiveProgramSessionInput): string {
  if (input.sessionId) return required(input.sessionId, "sessionId", 128);
  return createHash("sha256")
    .update(JSON.stringify([
      required(input.title, "session.title"),
      validIso(input.startsAt, "session.startsAt"),
    ]))
    .digest("hex");
}

function validTimezone(value: string): string {
  const normalized = required(value, "timezone", 80);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized });
    return normalized;
  } catch {
    throw new Error("timezone must be a valid IANA timezone");
  }
}

export class FirestoreProgramDeliveryStore {
  constructor(private readonly firestore: Firestore) {}

  private offeringRef(id: string) {
    return this.firestore.collection("programOfferings").doc(id);
  }

  async upsertOffering(
    input: ProgramOfferingInput,
    now = new Date().toISOString(),
  ): Promise<ProgramOffering> {
    validIso(now, "now");
    const id = offeringId(input);
    const ref = this.offeringRef(id);

    return this.firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const current = snapshot.exists
        ? (snapshot.data() as ProgramOffering)
        : undefined;
      const record: ProgramOffering = {
        offeringId: id,
        tenantId: required(input.tenantId, "tenantId"),
        programId: required(input.programId, "programId"),
        cohortKey: required(input.cohortKey, "cohortKey"),
        title: required(input.title, "title"),
        deliveryMode: input.deliveryMode,
        timezone: validTimezone(input.timezone),
        status: input.status ?? current?.status ?? "active",
        coachIds: [...new Set((input.coachIds ?? current?.coachIds ?? []).map((id) => required(id, "coachId", 128)))],
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      transaction.set(ref, record);
      return record;
    });
  }

  async scheduleSession(
    offeringIdValue: string,
    input: LiveProgramSessionInput,
    now = new Date().toISOString(),
  ): Promise<LiveProgramSession> {
    validIso(now, "now");
    const offeringRef = this.offeringRef(required(offeringIdValue, "offeringId", 128));
    const id = sessionId(input);
    const ref = offeringRef.collection("sessions").doc(id);

    return this.firestore.runTransaction(async (transaction) => {
      const [offeringSnapshot, sessionSnapshot] = await Promise.all([
        transaction.get(offeringRef),
        transaction.get(ref),
      ]);
      if (!offeringSnapshot.exists) throw new Error("PROGRAM_OFFERING_NOT_FOUND");

      const offering = offeringSnapshot.data() as ProgramOffering;
      if (offering.deliveryMode === "asynchronous") {
        throw new Error("ASYNCHRONOUS_OFFERING_HAS_NO_LIVE_SESSIONS");
      }

      const current = sessionSnapshot.exists
        ? (sessionSnapshot.data() as LiveProgramSession)
        : undefined;
      if (!Number.isFinite(input.durationMinutes)) {
        throw new Error("durationMinutes must be finite");
      }
      const durationMinutes = Math.round(input.durationMinutes);
      if (durationMinutes < 10 || durationMinutes > 720) {
        throw new Error("durationMinutes must be between 10 and 720");
      }

      const joinUrl = input.joinUrl === undefined
        ? current?.joinUrl
        : input.joinUrl.trim();
      if (joinUrl) {
        let parsed: URL;
        try {
          parsed = new URL(joinUrl);
        } catch {
          throw new Error("joinUrl must be a valid URL");
        }
        if (parsed.protocol !== "https:") {
          throw new Error("joinUrl must use https");
        }
      }

      const record: LiveProgramSession = {
        sessionId: id,
        offeringId: offering.offeringId,
        title: required(input.title, "session.title"),
        startsAt: validIso(input.startsAt, "session.startsAt"),
        durationMinutes,
        ...(joinUrl ? { joinUrl } : {}),
        recordingPolicy:
          input.recordingPolicy ??
          current?.recordingPolicy ??
          "none",
        status: input.status ?? current?.status ?? "scheduled",
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      transaction.set(ref, record);
      return record;
    });
  }

  async listOfferingsForPrograms(
    access: ProgramAccess[],
  ): Promise<ProgramOffering[]> {
    const uniqueAccess = new Map<string, ProgramAccess>();
    for (const item of access) {
      const normalized = {
        tenantId: required(item.tenantId, "tenantId"),
        programId: required(item.programId, "programId"),
        offeringId: required(item.offeringId, "offeringId", 128),
      };
      uniqueAccess.set(normalized.offeringId, normalized);
    }
    if (uniqueAccess.size === 0) return [];
    const snapshots = await Promise.all(
      [...uniqueAccess.values()].map((item) => this.offeringRef(item.offeringId).get()),
    );
    const offerings: ProgramOffering[] = [];
    for (const snapshot of snapshots) {
      if (!snapshot.exists) continue;
      const offering = snapshot.data() as ProgramOffering;
      const allowed = uniqueAccess.get(snapshot.id);
      if (allowed && offering.status === "active" &&
          offering.tenantId === allowed.tenantId &&
          offering.programId === allowed.programId) offerings.push(offering);
    }
    return offerings.sort((a, b) => a.title.localeCompare(b.title));
  }

  async listSessionsPage(
    offeringIdValue: string,
    limit = 100,
    cursor?: string,
  ): Promise<LiveProgramSessionPage> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      throw new Error("PROGRAM_SESSION_PAGE_LIMIT_INVALID");
    }
    const collection = this.offeringRef(
      required(offeringIdValue, "offeringId", 128),
    ).collection("sessions");
    let query = collection
      .orderBy("startsAt", "asc")
      .orderBy(FieldPath.documentId(), "asc")
      .limit(limit + 1);
    if (cursor) {
      query = query.startAfter(...decodeSessionCursor(cursor));
    }
    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, limit);
    const last = docs.at(-1);
    return {
      sessions: docs.map((doc) => doc.data() as LiveProgramSession),
      nextCursor: snapshot.size > limit && last
        ? Buffer.from(JSON.stringify([
            (last.data() as LiveProgramSession).startsAt, last.id,
          ])).toString("base64url")
        : null,
    };
  }

  async listUpcomingSessions(
    offeringIdValue: string,
    now = new Date().toISOString(),
    limit = 100,
  ): Promise<LiveProgramSession[]> {
    const normalizedNow = validIso(now, "now");
    const nowMs = Date.parse(normalizedNow);
    const earliestOngoingStart = new Date(nowMs - 720 * 60_000).toISOString();
    const boundedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.round(limit), 1), 100)
      : 100;
    const pageSize = Math.min(100, boundedLimit);
    const sessions: LiveProgramSession[] = [];
    const collection = this.offeringRef(
      required(offeringIdValue, "offeringId", 128),
    ).collection("sessions");
    let cursorStartsAt: string | undefined;
    let cursorId: string | undefined;

    while (sessions.length < boundedLimit) {
      let query = collection
        .where("startsAt", ">=", earliestOngoingStart)
        .orderBy("startsAt", "asc")
        .orderBy(FieldPath.documentId(), "asc")
        .limit(pageSize);

      if (cursorStartsAt && cursorId) {
        query = query.startAfter(cursorStartsAt, cursorId);
      }

      const snapshot = await query.get();
      for (const doc of snapshot.docs) {
        const session = doc.data() as LiveProgramSession;
        const endsAtMs = Date.parse(session.startsAt) + session.durationMinutes * 60_000;
        if (session.status === "scheduled" && endsAtMs > nowMs) {
          sessions.push(session);
          if (sessions.length >= boundedLimit) break;
        }
      }

      if (snapshot.size < pageSize) break;
      const last = snapshot.docs.at(-1);
      if (!last) break;
      const lastSession = last.data() as LiveProgramSession;
      cursorStartsAt = lastSession.startsAt;
      cursorId = last.id;
    }

    return sessions;
  }

  async upcomingForPrograms(
    access: ProgramAccess[],
    now = new Date().toISOString(),
  ): Promise<Array<{ offering: ProgramOffering; session: LiveProgramSession }>> {
    validIso(now, "now");
    const offerings = await this.listOfferingsForPrograms(access);
    const rows: Array<{ offering: ProgramOffering; session: LiveProgramSession }> = [];
    for (const offering of offerings) {
      const sessions = await this.listUpcomingSessions(
        offering.offeringId,
        now,
      );
      for (const session of sessions) {
        rows.push({ offering, session });
      }
    }
    return rows.sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
  }
}
