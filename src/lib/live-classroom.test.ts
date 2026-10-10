import { describe, expect, it } from "vitest";
import {
  classroomAdmission, classroomCapacity, classroomCloseAvailable, classroomParticipantId, classroomRoomName,
  resolveClassroomRole, reserveClassroomTokenQuota, summarizeClassroomPresence,
} from "./live-classroom";
import type { CommerceEnrollmentRecord } from "./commerce/enrollment";
import type { LiveProgramSession, ProgramOffering } from "./program-delivery";

const offering: ProgramOffering = {
  offeringId: "a".repeat(64), tenantId: "seres", programId: "mastery",
  cohortKey: "cohort-1", title: "Programa",
  deliveryMode: "live", timezone: "America/Bogota",
  status: "active", coachIds: ["coach-1"],
  createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
};
const session: LiveProgramSession = {
  sessionId: "session-1", offeringId: offering.offeringId, title: "Clase 1",
  startsAt: "2026-10-20T20:00:00.000Z", durationMinutes: 120,
  classroomProvider: "livekit", classroomCapacity: 120, recordingPolicy: "none",
  status: "scheduled", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z",
};
const enrollment = (overrides: Partial<CommerceEnrollmentRecord> = {}): CommerceEnrollmentRecord => ({
  enrollmentId: "e", tenantId: offering.tenantId, programId: offering.programId,
  offeringId: offering.offeringId, productId: "p", customerId: "c",
  learnerId: "learner-1", entitlementId: "ent",
  status: "active", lastProvider: "hotmart", lastProviderEventId: "evt",
  lastEventAt: "2026-10-01T00:00:00Z", createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...overrides,
});

describe("LUMA integrated classroom authorization", () => {
  it("accepts ONLY a valid active enrollment for the exact tenant/program/cohort", () => {
    const user = { uid: "learner-1" };
    const now = "2026-10-15T00:00:00Z";
    expect(resolveClassroomRole(user, offering, [enrollment()], now)).toBe("learner");
    expect(resolveClassroomRole(user, offering, [enrollment({ tenantId: "other" })], now)).toBeNull();
    expect(resolveClassroomRole(user, offering, [enrollment({ programId: "other" })], now)).toBeNull();
    expect(resolveClassroomRole(user, offering, [enrollment({ offeringId: "other" })], now)).toBeNull();
    expect(resolveClassroomRole(user, offering, [enrollment({ learnerId: "other" })], now)).toBeNull();
    expect(resolveClassroomRole(user, offering, [enrollment({ status: "revoked" })], now)).toBeNull();
    expect(resolveClassroomRole(user, offering, [enrollment({ accessEndsAt: now })], now)).toBeNull();
  });
  it("never turns a coach claim alone into arbitrary-cohort instructor permissions", () => {
    expect(resolveClassroomRole({ uid: "not-assigned", role: "coach" }, offering, [])).toBeNull();
    expect(resolveClassroomRole({ uid: "coach-1", role: "coach" }, offering, [])).toBe("instructor");
    expect(resolveClassroomRole({ uid: "coach-1" }, offering, [])).toBeNull();
    expect(resolveClassroomRole({ uid: "admin", admin: true }, offering, [])).toBeNull();
    expect(resolveClassroomRole({ uid: "admin", admin: true, adminTenantIds: ["other"] }, offering, [])).toBeNull();
    expect(resolveClassroomRole({ uid: "admin", admin: true, adminTenantIds: ["seres"] }, offering, [])).toBe("instructor");
    // Dedicated admin assignment must override legacy user/coach tenant claims.
    expect(resolveClassroomRole({
      uid: "admin", admin: true, tenantIds: ["seres"],
      adminTenantIds: ["another-tenant"],
    }, offering, [])).toBeNull();
    expect(resolveClassroomRole({
      uid: "admin", admin: true, tenantId: "seres",
      adminTenantIds: [],
    }, offering, [])).toBeNull();
    expect(resolveClassroomRole({ uid: "owner", superuser: true }, offering, [])).toBe("instructor");
  });
  it("isolates room names and participant IDs without exposing UIDs or emails", () => {
    const first = classroomRoomName("tenant-a", offering.offeringId, session.sessionId);
    const second = classroomRoomName("tenant-b", offering.offeringId, session.sessionId);
    expect(first).not.toBe(second);
    expect(classroomParticipantId(first, "learner-1")).not.toBe(classroomParticipantId(second, "learner-1"));
    expect(classroomParticipantId(first, "learner-1")).not.toContain("learner-1");
  });
  it("enforces provider, session state, capacity, early join and closing time", () => {
    const start = Date.parse(session.startsAt);
    expect(classroomAdmission(offering, session, start - 31 * 60_000)).toBe("not_open");
    expect(classroomAdmission(offering, session, start - 30 * 60_000)).toBe("allowed");
    expect(classroomAdmission(offering, session, start + 119 * 60_000)).toBe("allowed");
    expect(classroomAdmission(offering, session, start + 151 * 60_000)).toBe("closed");
    expect(classroomAdmission(offering, { ...session, status: "cancelled" }, start)).toBe("closed");
    expect(classroomAdmission(offering, { ...session, classroomProvider: "external" }, start)).toBe("closed");
    expect(classroomCapacity(session)).toBe(120);
    expect(() => classroomCapacity({ ...session, classroomCapacity: 2000 })).toThrow();
  });
});
describe("LUMA verified presence ledger", () => {
  it("recomputes connection intervals by event-time rather than arrival order", () => {
    const entries = [
      { id: "leave2", type: "participant_left" as const, atSeconds: 200 },
      { id: "join2", type: "participant_joined" as const, atSeconds: 180 },
      { id: "leave1", type: "participant_left" as const, atSeconds: 130 },
      { id: "join1", type: "participant_joined" as const, atSeconds: 100 },
    ];
    const summary = summarizeClassroomPresence(entries);
    expect(summary.attendedSeconds).toBe(50);
    expect(summary.connectionCount).toBe(2);
    expect(summary.connected).toBe(false);
  });
  it("does not count repeated joins twice and preserves open intervals", () => {
    const entries = [
      { id: "join1", type: "participant_joined" as const, atSeconds: 100 },
      { id: "join-duplicate-state", type: "participant_joined" as const, atSeconds: 105 },
    ];
    const summary = summarizeClassroomPresence(entries);
    expect(summary.attendedSeconds).toBe(0);
    expect(summary.connectionCount).toBe(1);
    expect(summary.connected).toBe(true);
  });
});

describe("distributed LiveKit admission budget", () => {
  it("rejects rapid repeat token issuance and caps each 15-minute period", () => {
    const initial = new Date("2026-10-20T20:00:00Z");
    const first = reserveClassroomTokenQuota(undefined, initial);
    expect(first?.issuedInWindow).toBe(1);
    expect(reserveClassroomTokenQuota(first!, new Date(initial.getTime() + 1000))).toBeNull();
    let state = first!;
    for (let index = 1; index < 24; index += 1) {
      const next = reserveClassroomTokenQuota(state, new Date(initial.getTime() + index * 3000));
      expect(next).not.toBeNull();
      state = next!;
    }
    expect(state.issuedInWindow).toBe(24);
    expect(reserveClassroomTokenQuota(state, new Date(initial.getTime() + 77_000))).toBeNull();
    expect(reserveClassroomTokenQuota(state, new Date(initial.getTime() + 15 * 60_000))?.issuedInWindow).toBe(1);
  });
});

describe("instructor overtime-classroom closure", () => {
  it("allows a safe early finish, overtime finish and completed-room cleanup retry", () => {
    const start = Date.parse(session.startsAt);
    expect(classroomCloseAvailable(session, start - 31 * 60_000)).toBe(false);
    expect(classroomCloseAvailable(session, start - 30 * 60_000)).toBe(true);
    expect(classroomCloseAvailable(session, start + 4 * 3_600_000)).toBe(true);
    expect(classroomCloseAvailable({ ...session, status: "completed" }, start + 4 * 3_600_000)).toBe(true);
    expect(classroomCloseAvailable({ ...session, status: "cancelled" }, start)).toBe(false);
    expect(classroomCloseAvailable({ ...session, classroomProvider: "external" }, start)).toBe(false);
  });
});
