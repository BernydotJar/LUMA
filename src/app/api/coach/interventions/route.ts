import { NextResponse } from "next/server";
import { commerceEnrollments } from "@/lib/commerce/server";
import { rankLearnerInterventions } from "@/lib/engagement";
import { learningStore, requireLearningCoachAccess } from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { access } = await requireLearningCoachAccess(request);
    let learners;
    if (access.unrestricted) {
      learners = await learningStore.listAll();
    } else {
      const allowed = new Set(access.learnerIds);
      for (const learnerId of await commerceEnrollments.listActiveLearnerIdsByTenants(access.tenantIds)) {
        allowed.add(learnerId);
      }
      learners = (
        await Promise.all([...allowed].map((learnerId) => learningStore.get(learnerId)))
      ).filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

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
    if (message === "COACH_SCOPE_REQUIRED") {
      return NextResponse.json({ error: "coach_scope_required" }, { status: 403 });
    }
    return NextResponse.json({ error: "coach_interventions_unavailable" }, { status: 500 });
  }
}
