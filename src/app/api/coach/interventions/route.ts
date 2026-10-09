import { NextResponse } from "next/server";
import { commerceEnrollments } from "@/lib/commerce/server";
import { rankLearnerInterventions } from "@/lib/engagement";
import { learningStore, requireLearningCoachAccess } from "@/lib/learning-server";

export const runtime = "nodejs";

const INTERVENTION_SCAN_LIMIT = 100;
const INTERVENTION_RESPONSE_LIMIT = 8;

export async function GET(request: Request) {
  try {
    const { access } = await requireLearningCoachAccess(request);
    let learners;
    if (access.unrestricted) {
      learners = await learningStore.list(INTERVENTION_SCAN_LIMIT);
    } else {
      const allowed = new Set(access.learnerIds.slice(0, INTERVENTION_SCAN_LIMIT));
      const remaining = INTERVENTION_SCAN_LIMIT - allowed.size;
      if (remaining > 0) {
        for (const learnerId of await commerceEnrollments.sampleActiveLearnerIdsByTenants(
          access.tenantIds, remaining,
        )) {
          allowed.add(learnerId);
        }
      }
      learners = (
        await Promise.all([...allowed].slice(0, INTERVENTION_SCAN_LIMIT)
          .map((learnerId) => learningStore.get(learnerId)))
      ).filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    const signals = rankLearnerInterventions(
      learners.map((item) => item.record),
    );

    return NextResponse.json({
      interventions: signals.slice(0, INTERVENTION_RESPONSE_LIMIT),
      summary: {
        activeLearners: learners.length,
        sampled: true,
        sampleSize: learners.length,
        scanLimit: INTERVENTION_SCAN_LIMIT,
        responseLimit: INTERVENTION_RESPONSE_LIMIT,
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
