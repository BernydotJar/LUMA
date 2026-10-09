import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { recordClassroomPresence } from "@/lib/live-classroom-attendance";
import { ClassroomWebhookBodyTooLarge, readClassroomWebhookBody } from "@/lib/live-classroom-webhook-body";
import { ClassroomError, liveKitConfiguration } from "@/lib/live-classroom-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let configuration;
  try {
    configuration = liveKitConfiguration();
  } catch (error) {
    const status = error instanceof ClassroomError ? error.status : 503;
    return NextResponse.json({ error: "webhook_unavailable" }, { status });
  }
  let rawBody: string;
  try {
    rawBody = await readClassroomWebhookBody(request);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof ClassroomWebhookBodyTooLarge
        ? "payload_too_large" : "invalid_payload",
    }, { status: error instanceof ClassroomWebhookBodyTooLarge ? 413 : 400 });
  }
  let event;
  try {
    const receiver = new WebhookReceiver(configuration.apiKey, configuration.apiSecret);
    event = await receiver.receive(rawBody, request.headers.get("authorization") ?? "");
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (event.event !== "participant_joined" && event.event !== "participant_left") {
    return new Response(null, { status: 204 });
  }
  if (!event.id || !event.room?.name || !event.participant?.identity ||
      !event.createdAt) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }
  try {
    await recordClassroomPresence({
      id: event.id,
      roomName: event.room.name,
      identity: event.participant.identity,
      atSeconds: Number(event.createdAt),
      type: event.event,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Classroom attendance ingest failed", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "attendance_ingest_retryable" }, { status: 503 });
  }
}
