import { describe, expect, it } from "vitest";
import { parseLearnerScheduleResponse, programScheduleStatus } from "./program-schedule-status";

describe("learner live program agenda status", () => {
  it("does not equate an HTTP failure with no scheduled live sessions", () => {
    expect(programScheduleStatus([], true)).toBe("load_failed");
  });

  it("distinguishes an unauthorized session from an empty schedule", () => {
    expect(programScheduleStatus(undefined)).toBe("access_unverified");
  });

  it("treats an authenticated empty schedule as legitimately empty", () => {
    expect(programScheduleStatus([])).toBe("empty");
  });

  it("displays confirmed upcoming sessions", () => {
    expect(programScheduleStatus([{ sessionId: "s-1" }])).toBe("ready");
  });
});

describe("learner schedule API response contract", () => {
  const validSession = {
    offeringId: "offering-1",
    programId: "program-1",
    offeringTitle: "Sesiones en vivo",
    deliveryMode: "live",
    timezone: "America/Bogota",
    session: {
      sessionId: "session-1",
      offeringId: "offering-1",
      title: "Encuentro con el entrenador",
      startsAt: "2026-10-20T20:00:00.000Z",
      durationMinutes: 90,
      recordingPolicy: "none",
      status: "scheduled",
      createdAt: "2026-10-09T08:00:00.000Z",
      updatedAt: "2026-10-09T08:00:00.000Z",
      joinUrl: "https://meet.example.com/session-1",
    },
  };

  it("accepts an explicitly empty valid result", () => {
    expect(parseLearnerScheduleResponse({ schedule: [] })).toEqual([]);
  });

  it("rejects missing, null and incorrectly typed schedule arrays", () => {
    for (const body of [{}, { schedule: null }, { schedule: "none" }, null, []]) {
      expect(() => parseLearnerScheduleResponse(body)).toThrow("PROGRAM_SCHEDULE_INVALID_RESPONSE");
    }
  });

  it("validates each returned live offering before presenting it", () => {
    expect(parseLearnerScheduleResponse({ schedule: [validSession] })).toHaveLength(1);
    expect(() => parseLearnerScheduleResponse({ schedule: [{}] })).toThrow("PROGRAM_SCHEDULE_INVALID_RESPONSE");
    expect(() => parseLearnerScheduleResponse({
      schedule: [{ ...validSession, session: { ...validSession.session, durationMinutes: null } }],
    })).toThrow("PROGRAM_SCHEDULE_INVALID_RESPONSE");
  });

  it("does not render insecure join links from malformed API data", () => {
    expect(() => parseLearnerScheduleResponse({
      schedule: [{ ...validSession, session: { ...validSession.session, joinUrl: "javascript:alert(1)" } }],
    })).toThrow("PROGRAM_SCHEDULE_INVALID_RESPONSE");
  });
});
