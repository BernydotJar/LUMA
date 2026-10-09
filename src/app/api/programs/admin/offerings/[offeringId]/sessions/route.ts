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
    const query = new URL(request.url).searchParams;
    const rawLimit = query.get("limit");
    const limit = rawLimit === null ? 100 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      return NextResponse.json({ error: "invalid_page_limit" }, { status: 400 });
    }
    const cursor = query.get("cursor") ?? undefined;
    if (cursor && !/^[A-Za-z0-9_-]{1,1024}$/.test(cursor)) {
      return NextResponse.json({ error: "invalid_page_cursor" }, { status: 400 });
    }
    const page = await programDeliveryStore.listSessionsPage(offeringId, limit, cursor);
    return NextResponse.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "PROGRAM_SESSION_CURSOR_INVALID") {
      return NextResponse.json({ error: "invalid_page_cursor" }, { status: 400 });
    }
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
