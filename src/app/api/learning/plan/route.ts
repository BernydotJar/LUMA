import { NextResponse } from "next/server";
import { learningStore, requireLearningUser } from "@/lib/learning-server";
import type { StoredOnboardingState } from "@/lib/learner-projection";

export const runtime = "nodejs";

function isOnboarding(value: unknown): value is StoredOnboardingState {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  return (
    ["emotions", "beliefs", "communication"].includes(String(input.goal)) &&
    (input.diagnostic === null || ["a", "b", "c"].includes(String(input.diagnostic))) &&
    Number.isInteger(input.confidence) &&
    Number(input.confidence) >= 1 &&
    Number(input.confidence) <= 5 &&
    [8, 12, 20, 35].includes(Number(input.minutes)) &&
    typeof input.createdAt === "string" &&
    input.createdAt.length <= 64 &&
    !Number.isNaN(Date.parse(input.createdAt))
  );
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "AUTH_REQUIRED") {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  return NextResponse.json({ error: "learning_state_unavailable" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const result = await learningStore.get(user.uid);
    if (!result) {
      return NextResponse.json({ error: "learner_state_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      plan: result.plan,
      persistence: {
        source: "firestore",
        version: result.record.version,
        journeyId: result.record.journeyId,
        lastEventId: result.record.lastEventId ?? null,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const body = (await request.json()) as { onboarding?: unknown };
    if (!isOnboarding(body.onboarding)) {
      return NextResponse.json({ error: "invalid_onboarding" }, { status: 400 });
    }

    const result = await learningStore.bootstrap(user.uid, body.onboarding);
    return NextResponse.json({
      plan: result.plan,
      duplicate: result.duplicate,
      persistence: {
        source: "firestore",
        version: result.record.version,
        journeyId: result.record.journeyId,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
