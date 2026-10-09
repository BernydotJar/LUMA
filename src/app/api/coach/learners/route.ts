import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { commerceEnrollments } from "@/lib/commerce/server";
import {
  listScopedCoachLearnerIds,
  resolveCoachLearningScope,
} from "@/lib/coach-scoped-learning";
import {
  learningStore, learningStoreForScope, requireLearningCoachAccess,
} from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { access } = await requireLearningCoachAccess(request);
    const scope = resolveCoachLearningScope(access, request.headers);
    let results;
    if (scope) {
      const ids = await listScopedCoachLearnerIds(access, scope, commerceEnrollments, 50);
      const store = learningStoreForScope(scope);
      results = (await Promise.all(ids.map((uid) => store.get(uid))))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt))
        .slice(0, 50);
    } else if (access.unrestricted) {
      results = await learningStore.list(50);
    } else {
      const allowed = new Set(access.learnerIds.slice(0, 50));
      if (allowed.size < 50) {
        for (const learnerId of await commerceEnrollments.sampleActiveLearnerIdsByTenants(
          access.tenantIds, 50 - allowed.size,
        )) allowed.add(learnerId);
      }
      results = (
        await Promise.all([...allowed].slice(0, 50).map((uid) => learningStore.get(uid)))
      ).filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((a, b) => b.record.updatedAt.localeCompare(a.record.updatedAt))
        .slice(0, 50);
    }

    return NextResponse.json({
      sampled: Boolean(scope) || !access.unrestricted,
      limit: 50,
      ...(scope ? { tenantId: scope.tenantId, programId: scope.programId } : {}),
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
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    if (code === "COACH_REQUIRED" || code === "COACH_SCOPE_REQUIRED") {
      return NextResponse.json({ error: "coach_scope_required" }, { status: 403 });
    }
    if (code === "LEARNING_PROGRAM_SELECTION_REQUIRED") {
      return NextResponse.json({ error: "program_selection_required" }, { status: 409 });
    }
    return NextResponse.json({ error: "coach_learners_unavailable" }, { status: 500 });
  }
}
