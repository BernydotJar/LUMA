import { NextResponse } from "next/server";
import { learningStoreForScope, requireLearningUser } from "@/lib/learning-server";
import { requireLearningEntitlement } from "@/lib/learning-entitlement-server";
import { learningAccessFailure } from "@/lib/learning-entitlement";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import type { StoredOnboardingState, StoredLearningEvent } from "@/lib/learner-projection";

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
  if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const failure = learningAccessFailure(error);
  if (failure) return NextResponse.json({ error: failure.error }, { status: failure.status });
  return NextResponse.json({ error: "learning_state_unavailable" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const scope = await requireLearningEntitlement(user, request.headers.get("x-luma-program-id"));
    const result = await learningStoreForScope(scope).get(user.uid);
    if (!result) {
      return NextResponse.json({ error: "learner_state_not_found" }, { status: 404 });
    }

    // The graded receipt is selected from this authenticated learner's scoped
    // server ledger. Self-reported reflections cannot displace scored evidence.
    const stored = result.record.lastScoredEvidence;
    // Existing enrollments predate denormalized scored evidence. For those
    // records, read the scoped ledger without pretending another event is a score.
    const historical = stored ? [] : await learningStoreForScope(scope).listEvents(user.uid, 50);
    const scoredEvidence = stored ?? historical
      .map((row) => row as unknown as StoredLearningEvent)
      .find((row) =>
        row.type === "SIMULATION_COMPLETED" &&
        row.evidenceCategory === "scored" &&
        row.twinAuthority === "eligible" &&
        Array.isArray(row.criteria) && row.criteria.length > 0,
      );

    return NextResponse.json({
      plan: result.plan,
      onboarding: result.record.onboarding,
      scoredEvidence: scoredEvidence ?? null,
      program: scope ? { tenantId: scope.tenantId, programId: scope.programId } : null,
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
    const scope = await requireLearningEntitlement(user, request.headers.get("x-luma-program-id"));
    const body = (await request.json()) as { onboarding?: unknown };
    if (!isOnboarding(body.onboarding)) {
      return NextResponse.json({ error: "invalid_onboarding" }, { status: 400 });
    }

    const result = await learningStoreForScope(scope).bootstrap(user.uid, body.onboarding);
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
