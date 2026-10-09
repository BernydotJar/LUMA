import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { commerceEnrollments } from "@/lib/commerce/server";
import {
  listScopedCoachLearnerIds,
  resolveCoachLearningScope,
} from "@/lib/coach-scoped-learning";
import { rankLearnerInterventions } from "@/lib/engagement";
import {
  learningStore, learningStoreForScope, requireLearningCoachAccess,
} from "@/lib/learning-server";

export const runtime = "nodejs";

const INTERVENTION_SCAN_LIMIT = 100;
const INTERVENTION_RESPONSE_LIMIT = 8;

export async function GET(request: Request) {
  try {
    const { access } = await requireLearningCoachAccess(request);
    const scope = resolveCoachLearningScope(access, request.headers);
    let learners;
    if (scope) {
      const ids = await listScopedCoachLearnerIds(
        access, scope, commerceEnrollments, INTERVENTION_SCAN_LIMIT,
      );
      const store = learningStoreForScope(scope);
      learners = (await Promise.all(ids.map((uid) => store.get(uid))))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    } else if (access.unrestricted) {
      learners = await learningStore.list(INTERVENTION_SCAN_LIMIT);
    } else {
      const allowed = new Set(access.learnerIds.slice(0, INTERVENTION_SCAN_LIMIT));
      const remaining = INTERVENTION_SCAN_LIMIT - allowed.size;
      if (remaining > 0) {
        for (const id of await commerceEnrollments.sampleActiveLearnerIdsByTenants(
          access.tenantIds, remaining,
        )) allowed.add(id);
      }
      learners = (await Promise.all([...allowed].slice(0, INTERVENTION_SCAN_LIMIT)
        .map((uid) => learningStore.get(uid))))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
    }

    const signals = rankLearnerInterventions(learners.map((item) => item.record));
    return NextResponse.json({
      ...(scope ? { tenantId: scope.tenantId, programId: scope.programId } : {}),
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
    return NextResponse.json({ error: "coach_interventions_unavailable" }, { status: 500 });
  }
}
