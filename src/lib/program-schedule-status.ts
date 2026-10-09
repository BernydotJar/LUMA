/** A missing, denied, or failed live schedule must never look like a confirmed empty agenda. */
export type ProgramScheduleStatus = "ready" | "empty" | "access_unverified" | "load_failed";

export function programScheduleStatus(
  sessions: readonly unknown[] | undefined,
  failed = false,
): ProgramScheduleStatus {
  if (failed) return "load_failed";
  if (sessions === undefined) return "access_unverified";
  return sessions.length === 0 ? "empty" : "ready";
}

import type { LearnerScheduledSession } from "./program-api-client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validIanaTimezone(value: unknown): boolean {
  if (!requiredText(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function secureJoinUrl(value: unknown): boolean {
  if (value === undefined) return true;
  if (!requiredText(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Fail closed on schema drift or incomplete responses, instead of claiming no sessions exist. */
export function parseLearnerScheduleResponse(body: unknown): LearnerScheduledSession[] {
  if (!isRecord(body) || !Array.isArray(body.schedule)) {
    throw new Error("PROGRAM_SCHEDULE_INVALID_RESPONSE");
  }

  for (const row of body.schedule as unknown[]) {
    if (!isRecord(row) || !isRecord(row.session) ||
        !requiredText(row.offeringId) || !requiredText(row.programId) ||
        !requiredText(row.offeringTitle) || !validIanaTimezone(row.timezone) ||
        !["live", "hybrid"].includes(String(row.deliveryMode)) ||
        !requiredText(row.session.sessionId) ||
        !requiredText(row.session.title) ||
        !requiredText(row.session.startsAt) ||
        !Number.isFinite(Date.parse(row.session.startsAt)) ||
        typeof row.session.durationMinutes !== "number" ||
        !Number.isFinite(row.session.durationMinutes) ||
        row.session.durationMinutes <= 0 ||
        !secureJoinUrl(row.session.joinUrl) ||
        (row.session.classroomProvider !== undefined &&
          !["external", "livekit"].includes(String(row.session.classroomProvider))) ||
        (row.session.classroomProvider === "livekit" &&
          (row.session.classroomCapacity !== undefined &&
            (!Number.isInteger(row.session.classroomCapacity) ||
             Number(row.session.classroomCapacity) < 2 ||
             Number(row.session.classroomCapacity) > 1000)))) {
      throw new Error("PROGRAM_SCHEDULE_INVALID_RESPONSE");
    }
  }

  return body.schedule as LearnerScheduledSession[];
}
