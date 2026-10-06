import { NextResponse } from "next/server";
import { learningStore, requireLearningCoach } from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  try {
    await requireLearningCoach(request);
    const { learnerId } = await params;
    const result = await learningStore.get(learnerId);

    if (!result) {
      return NextResponse.json({ error: "learner_not_found" }, { status: 404 });
    }

    const events = await learningStore.listEvents(learnerId, 20);
    return NextResponse.json({
      record: result.record,
      plan: result.plan,
      events,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (message === "COACH_REQUIRED") {
      return NextResponse.json({ error: "coach_role_required" }, { status: 403 });
    }
    return NextResponse.json({ error: "coach_learner_unavailable" }, { status: 500 });
  }
}
