import { NextResponse } from "next/server";
import { commerceEnrollments } from "@/lib/commerce/server";
import { learningStore, requireLearningCoachAccess } from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  try {
    const { access } = await requireLearningCoachAccess(request);
    const { learnerId } = await params;

    if (!access.unrestricted) {
      const explicit = access.learnerIds.includes(learnerId);
      const tenantAccess = explicit
        ? true
        : await commerceEnrollments.learnerHasActiveTenantAccess(learnerId, access.tenantIds);
      if (!tenantAccess) {
        return NextResponse.json({ error: "learner_scope_forbidden" }, { status: 403 });
      }
    }

    const result = await learningStore.get(learnerId);
    if (!result) {
      return NextResponse.json({ error: "learner_not_found" }, { status: 404 });
    }

    const events = await learningStore.listEvents(learnerId, 20);
    return NextResponse.json({ record: result.record, plan: result.plan, events });
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
    return NextResponse.json({ error: "coach_learner_unavailable" }, { status: 500 });
  }
}
