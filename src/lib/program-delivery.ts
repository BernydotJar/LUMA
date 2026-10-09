import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";

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
  if (!Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO timestamp`);
  }
  return value;
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
      const durationMinutes = Math.round(input.durationMinutes);
      if (durationMinutes < 10 || durationMinutes > 720) {
        throw new Error("durationMinutes must be between 10 and 720");
      }

      const joinUrl = input.joinUrl?.trim();
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
    programIds: string[],
  ): Promise<ProgramOffering[]> {
    const wanted = new Set(programIds.map((id) => id.trim()).filter(Boolean));
    if (wanted.size === 0) return [];
    const snapshot = await this.firestore
      .collection("programOfferings")
      .limit(250)
      .get();
    return snapshot.docs
      .map((doc) => doc.data() as ProgramOffering)
      .filter((item) => item.status === "active" && wanted.has(item.programId))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  async listSessions(
    offeringIdValue: string,
  ): Promise<LiveProgramSession[]> {
    const snapshot = await this.offeringRef(
      required(offeringIdValue, "offeringId", 128),
    )
      .collection("sessions")
      .orderBy("startsAt", "asc")
      .limit(100)
      .get();
    return snapshot.docs.map((doc) => doc.data() as LiveProgramSession);
  }

  async upcomingForPrograms(
    programIds: string[],
    now = new Date().toISOString(),
  ): Promise<Array<{ offering: ProgramOffering; session: LiveProgramSession }>> {
    validIso(now, "now");
    const offerings = await this.listOfferingsForPrograms(programIds);
    const rows: Array<{ offering: ProgramOffering; session: LiveProgramSession }> = [];
    for (const offering of offerings) {
      const sessions = await this.listSessions(offering.offeringId);
      for (const session of sessions) {
        if (
          session.status === "scheduled" &&
          Date.parse(session.startsAt) >= Date.parse(now)
        ) {
          rows.push({ offering, session });
        }
      }
    }
    return rows.sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
  }
}
