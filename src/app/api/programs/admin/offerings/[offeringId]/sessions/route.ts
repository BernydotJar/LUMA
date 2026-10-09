import { NextResponse } from "next/server";
import { requireLearningAdmin } from "@/lib/learning-server";
import { programDeliveryStore } from "@/lib/program-delivery-server";
import type { LiveSessionStatus, RecordingPolicy } from "@/lib/program-delivery";

export const runtime = "nodejs";

const statuses = new Set<LiveSessionStatus>([
  "scheduled",
  "completed",
  "cancelled",
]);
const recordingPolicies = new Set<RecordingPolicy>([
  "none",
  "optional",
  "available_after_session",
]);

function authResponse(message: string) {
  if (message === "AUTH_REQUIRED") {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  if (message === "ADMIN_REQUIRED") {
    return NextResponse.json({ error: "admin_role_required" }, { status: 403 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ offeringId: string }> },
) {
  try {
    await requireLearningAdmin(request);
    const { offeringId } = await context.params;
    const sessions = await programDeliveryStore.listSessions(offeringId);
    return NextResponse.json({ sessions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return (
      authResponse(message) ??
      NextResponse.json({ error: "program_sessions_unavailable" }, { status: 500 })
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ offeringId: string }> },
) {
  try {
    await requireLearningAdmin(request);
    const { offeringId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.title !== "string" || typeof body.startsAt !== "string") {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    const recordingPolicy =
      typeof body.recordingPolicy === "string"
        ? (body.recordingPolicy as RecordingPolicy)
        : undefined;
    if (recordingPolicy && !recordingPolicies.has(recordingPolicy)) {
      return NextResponse.json({ error: "invalid_recording_policy" }, { status: 400 });
    }
    const status =
      typeof body.status === "string"
        ? (body.status as LiveSessionStatus)
        : undefined;
    if (status && !statuses.has(status)) {
      return NextResponse.json({ error: "invalid_session_status" }, { status: 400 });
    }

    const session = await programDeliveryStore.scheduleSession(offeringId, {
      ...(typeof body.sessionId === "string" ? { sessionId: body.sessionId } : {}),
      title: body.title,
      startsAt: body.startsAt,
      durationMinutes: Number(body.durationMinutes),
      ...(typeof body.joinUrl === "string" ? { joinUrl: body.joinUrl } : {}),
      ...(recordingPolicy ? { recordingPolicy } : {}),
      ...(status ? { status } : {}),
    });

    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return (
      authResponse(message) ??
      NextResponse.json({ error: "invalid_program_session" }, { status: 400 })
    );
  }
}
