import { NextResponse } from "next/server";
import { commerceEnrollments } from "@/lib/commerce/server";
import { learningStore, requireLearningCoachAccess } from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { access } = await requireLearningCoachAccess(request);
    let results;
    if (access.unrestricted) {
      results = await learningStore.list(50);
    } else {
      const allowed = new Set(access.learnerIds.slice(0, 50));
      if (allowed.size < 50) {
        for (const learnerId of await commerceEnrollments.sampleActiveLearnerIdsByTenants(
          access.tenantIds, 50 - allowed.size,
        )) {
          allowed.add(learnerId);
        }
      }
      results = (
        await Promise.all([...allowed].slice(0, 50).map((learnerId) => learningStore.get(learnerId)))
      )
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt))
        .slice(0, 50);
    }

    return NextResponse.json({
      // A bounded snapshot of authorized learners, not a complete tenant census.
      sampled: !access.unrestricted,
      limit: 50,
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
    if (message === "COACH_SCOPE_REQUIRED") {
      return NextResponse.json({ error: "coach_scope_required" }, { status: 403 });
    }
    return NextResponse.json({ error: "coach_learners_unavailable" }, { status: 500 });
  }
}
