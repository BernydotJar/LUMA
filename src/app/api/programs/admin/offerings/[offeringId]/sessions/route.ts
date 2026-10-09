import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { requireLearningAdmin } from "@/lib/learning-server";
import { assertTenantAdmin } from "@/lib/tenant-admin-access";
import { programDeliveryStore } from "@/lib/program-delivery-server";
import type {
  ClassroomProvider, LiveSessionStatus, ProgramOffering, RecordingPolicy,
} from "@/lib/program-delivery";

export const runtime = "nodejs";
const statuses = new Set<LiveSessionStatus>(["scheduled", "completed", "cancelled"]);
const recordingPolicies = new Set<RecordingPolicy>(["none", "optional", "available_after_session"]);

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const status = message === "AUTH_REQUIRED" ? 401 :
    message === "ADMIN_REQUIRED" || message === "TENANT_ADMIN_FORBIDDEN" ||
    message === "TENANT_ADMIN_REQUIRED" ? 403 :
    message === "PROGRAM_OFFERING_NOT_FOUND" ? 404 : 400;
  return NextResponse.json({
    error: status === 401 ? "authentication_required" :
      status === 403 ? "not_authorized" :
      status === 404 ? "offering_not_found" : "invalid_program_session",
  }, { status, headers: { "cache-control": "no-store" } });
}

async function authorizedOffering(request: Request, offeringId: string) {
  const admin = await requireLearningAdmin(request);
  if (!/^[a-f0-9]{64}$/.test(offeringId)) throw new Error("PROGRAM_OFFERING_NOT_FOUND");
  const doc = await firebaseAdminFirestore.collection("programOfferings").doc(offeringId).get();
  if (!doc.exists) throw new Error("PROGRAM_OFFERING_NOT_FOUND");
  const offering = doc.data() as ProgramOffering;
  if (offering.offeringId !== offeringId) throw new Error("PROGRAM_OFFERING_NOT_FOUND");
  assertTenantAdmin(admin as Record<string, unknown>, offering.tenantId);
  return offering;
}

export async function GET(
  request: Request, context: { params: Promise<{ offeringId: string }> },
) {
  try {
    const { offeringId } = await context.params;
    await authorizedOffering(request, offeringId);
    const query = new URL(request.url).searchParams;
    const limit = query.has("limit") ? Number(query.get("limit")) : 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      return NextResponse.json({ error: "invalid_page_limit" }, { status: 400 });
    }
    const cursor = query.get("cursor") || undefined;
    if (cursor && !/^[A-Za-z0-9_-]{1,1024}$/.test(cursor)) {
      return NextResponse.json({ error: "invalid_page_cursor" }, { status: 400 });
    }
    const page = await programDeliveryStore.listSessionsPage(offeringId, limit, cursor);
    return NextResponse.json(page, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(
  request: Request, context: { params: Promise<{ offeringId: string }> },
) {
  try {
    const { offeringId } = await context.params;
    const offering = await authorizedOffering(request, offeringId);
    if (offering.status !== "active" && offering.status !== "draft") {
      return NextResponse.json({ error: "offering_not_schedulable" }, { status: 409 });
    }
    const body = await request.json() as Record<string, unknown>;
    if (typeof body.title !== "string" || typeof body.startsAt !== "string") {
      return NextResponse.json({ error: "invalid_session" }, { status: 400 });
    }
    const recordingPolicy = body.recordingPolicy as RecordingPolicy | undefined;
    if (recordingPolicy && !recordingPolicies.has(recordingPolicy)) {
      return NextResponse.json({ error: "invalid_recording_policy" }, { status: 400 });
    }
    const status = body.status as LiveSessionStatus | undefined;
    if (status && !statuses.has(status)) {
      return NextResponse.json({ error: "invalid_session_status" }, { status: 400 });
    }
    const classroomProvider = body.classroomProvider as ClassroomProvider | undefined;
    if (classroomProvider && !["external", "livekit"].includes(classroomProvider)) {
      return NextResponse.json({ error: "invalid_classroom_provider" }, { status: 400 });
    }
    const classroomCapacity = body.classroomCapacity === undefined ?
      undefined : Number(body.classroomCapacity);
    if (classroomCapacity !== undefined &&
        (!Number.isInteger(classroomCapacity) || classroomCapacity < 2 || classroomCapacity > 1000)) {
      return NextResponse.json({ error: "invalid_classroom_capacity" }, { status: 400 });
    }
    const durationMinutes = Number(body.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 10 || durationMinutes > 720) {
      return NextResponse.json({ error: "invalid_session_duration" }, { status: 400 });
    }
    if (!Number.isFinite(Date.parse(body.startsAt)) ||
        Date.parse(body.startsAt) < Date.now() - 120_000) {
      return NextResponse.json({ error: "invalid_session_start" }, { status: 400 });
    }
    const session = await programDeliveryStore.scheduleSession(offeringId, {
      ...(typeof body.sessionId === "string" ? { sessionId: body.sessionId } : {}),
      title: body.title,
      startsAt: body.startsAt,
      durationMinutes,
      ...(typeof body.joinUrl === "string" ? { joinUrl: body.joinUrl } : {}),
      ...(classroomProvider ? { classroomProvider } : {}),
      ...(classroomCapacity !== undefined ? { classroomCapacity } : {}),
      ...(recordingPolicy ? { recordingPolicy } : {}),
      ...(status ? { status } : {}),
    });
    return NextResponse.json({ session }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
