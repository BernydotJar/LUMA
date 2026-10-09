import { NextResponse } from "next/server";
import { learningStoreForScope, requireLearningUser } from "@/lib/learning-server";
import { requireLearningEntitlement } from "@/lib/learning-entitlement-server";
import { learningAccessFailure } from "@/lib/learning-entitlement";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { verifyLearningEvent } from "@/lib/persistent-learning";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const scope = await requireLearningEntitlement(user, request.headers.get("x-luma-program-id"));
    const body = (await request.json()) as { eventId?: unknown; event?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";

    const event = verifyLearningEvent(body.event);
    if (!eventId || eventId.length > 128 || !event) {
      return NextResponse.json({ error: "invalid_learning_event" }, { status: 400 });
    }

    const result = await learningStoreForScope(scope).appendEvent(user.uid, eventId, event);
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
    if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    const failure = learningAccessFailure(error);
    if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status });
    if (message === "LEARNER_NOT_FOUND") {
      return NextResponse.json({ error: "learner_state_not_found" }, { status: 409 });
    }
    return NextResponse.json({ error: "learning_event_unavailable" }, { status: 500 });
  }
}
