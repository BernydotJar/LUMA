import { NextResponse } from "next/server";
import { rankLearnerInterventions } from "@/lib/engagement";
import { learningStore, requireLearningCoach } from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireLearningCoach(request);
    const learners = await learningStore.listAll();
    const signals = rankLearnerInterventions(
      learners.map((item) => item.record),
    );

    return NextResponse.json({
      interventions: signals,
      summary: {
        activeLearners: learners.length,
        high: signals.filter((item) => item.priority === "high").length,
        medium: signals.filter((item) => item.priority === "medium").length,
        low: signals.filter((item) => item.priority === "low").length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (message === "COACH_REQUIRED") {
      return NextResponse.json({ error: "coach_role_required" }, { status: 403 });
    }
    return NextResponse.json({ error: "coach_interventions_unavailable" }, { status: 500 });
  }
}
