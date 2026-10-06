import { NextResponse } from "next/server";
import { learningStore, requireLearningUser } from "@/lib/learning-server";
import { verifyLearningEvent } from "@/lib/persistent-learning";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const body = (await request.json()) as { eventId?: unknown; event?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";

    const event = verifyLearningEvent(body.event);
    if (!eventId || eventId.length > 128 || !event) {
      return NextResponse.json({ error: "invalid_learning_event" }, { status: 400 });
    }

    const result = await learningStore.appendEvent(user.uid, eventId, event);
    return NextResponse.json({
      plan: result.plan,
      duplicate: result.duplicate,
      persistence: {
        source: "firestore",
        version: result.record.version,
        journeyId: result.record.journeyId,
        lastEventId: result.record.lastEventId ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (message === "LEARNER_NOT_FOUND") {
      return NextResponse.json({ error: "learner_state_not_found" }, { status: 409 });
    }
    return NextResponse.json({ error: "learning_event_unavailable" }, { status: 500 });
  }
}
