import { NextResponse } from "next/server";
import { learningStore, requireLearningCoach } from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireLearningCoach(request);
    const results = await learningStore.list(50);

    return NextResponse.json({
      learners: results.map(({ record, plan }) => ({
        learnerId: record.learnerId,
        goal: record.state.goal,
        nextActionTitle: plan.nextAction.title,
        nextActionId: plan.nextAction.id,
        version: record.version,
        updatedAt: record.updatedAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (message === "COACH_REQUIRED") {
      return NextResponse.json({ error: "coach_role_required" }, { status: 403 });
    }
    return NextResponse.json({ error: "coach_learners_unavailable" }, { status: 500 });
  }
}
