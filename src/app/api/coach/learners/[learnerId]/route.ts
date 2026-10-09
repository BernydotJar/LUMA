import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { commerceEnrollments } from "@/lib/commerce/server";
import {
  assertScopedCoachLearner,
  resolveCoachLearningScope,
} from "@/lib/coach-scoped-learning";
import {
  learningStoreForScope, requireLearningCoachAccess,
} from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ learnerId: string }> },
) {
  try {
    const { access } = await requireLearningCoachAccess(request);
    const { learnerId } = await params;
    if (!learnerId || learnerId.includes("/") || learnerId.length > 256) {
      return NextResponse.json({ error: "invalid_learner_id" }, { status: 400 });
    }

    const scope = resolveCoachLearningScope(access, request.headers);
    if (scope) {
      await assertScopedCoachLearner(access, scope, learnerId, commerceEnrollments);
    } else if (!access.unrestricted) {
      const explicit = access.learnerIds.includes(learnerId);
      const tenantAccess = explicit ||
        await commerceEnrollments.learnerHasActiveTenantAccess(learnerId, access.tenantIds);
      if (!tenantAccess) {
        return NextResponse.json({ error: "learner_scope_forbidden" }, { status: 403 });
      }
    }

    const store = learningStoreForScope(scope);
    const result = await store.get(learnerId);
    if (!result) {
      return NextResponse.json({ error: "learner_not_found" }, { status: 404 });
    }
    const events = await store.listEvents(learnerId, 20);
    return NextResponse.json({
      ...(scope ? { tenantId: scope.tenantId, programId: scope.programId } : {}),
      record: result.record, plan: result.plan, events,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (code === "COACH_REQUIRED" || code === "COACH_SCOPE_REQUIRED" ||
        code === "COACH_LEARNER_SCOPE_FORBIDDEN") {
      return NextResponse.json({ error: "learner_scope_forbidden" }, { status: 403 });
    }
    if (code === "LEARNING_PROGRAM_SELECTION_REQUIRED") {
      return NextResponse.json({ error: "program_selection_required" }, { status: 409 });
    }
    return NextResponse.json({ error: "coach_learner_unavailable" }, { status: 500 });
  }
}
