import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { learningStoreForScope } from "@/lib/learning-server";
import { commerceEnrollments } from "@/lib/commerce/server";
import { assertScopedCoachLearner } from "@/lib/coach-scoped-learning";
import { HumanInterventionStore } from "@/lib/twin-intelligence/human-store";
import { pilotError, pilotTeacherContext, readPilotJson } from "@/lib/twin-intelligence/server";

export const runtime = "nodejs";
const store = new HumanInterventionStore(firebaseAdminFirestore);

function isShortId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(value);
}

export async function GET(request: Request) {
  try {
    const { scope, teacherUid, access } = await pilotTeacherContext(request);
    const records = await store.listByTeacher(scope, teacherUid, 20);
    // Revoked learners must not remain exposed through an old intervention.
    const allowed = await Promise.all(records.map(async (record) => {
      try {
        await assertScopedCoachLearner(access, scope, record.learnerId, commerceEnrollments);
        return record;
      } catch { return undefined; }
    }));
    return NextResponse.json({ interventions: allowed.filter(Boolean) });
  } catch (error) { return pilotError(error); }
}

export async function POST(request: Request) {
  try {
    const { scope, teacherUid, access } = await pilotTeacherContext(request);
    const input = await readPilotJson(request) as Record<string, unknown> | null;
    if (!input || !isShortId(input.learnerId) ||
        !isShortId(input.reasonEventId) || !isShortId(input.idempotencyKey)) {
      return NextResponse.json({ error: "invalid_intervention" }, { status: 400 });
    }
    await assertScopedCoachLearner(access, scope, input.learnerId, commerceEnrollments);
    // A recommendation alone is not evidence. Only persisted learning events
    // from the authorized learner may open a human follow-up.
    const events = await learningStoreForScope(scope).listEvents(input.learnerId, 50);
    if (!events.some((e) => e.id === input.reasonEventId)) {
      return NextResponse.json({ error: "verified_reason_event_required" }, { status: 409 });
    }
    const record = await store.open(scope, teacherUid,
      input.learnerId, input.reasonEventId, input.idempotencyKey);
    return NextResponse.json({ intervention: record }, { status: 201 });
  } catch (error) { return pilotError(error); }
}

export async function PUT(request: Request) {
  try {
    const { scope, teacherUid, access } = await pilotTeacherContext(request);
    const input = await readPilotJson(request) as Record<string, unknown> | null;
    if (!input || !isShortId(input.learnerId) ||
        typeof input.interventionId !== "string" ||
        !/^[a-f0-9]{64}$/.test(input.interventionId) ||
        input.expectedRevision !== 1 ||
        !["COMPLETED", "DISMISSED"].includes(String(input.outcome)) ||
        (input.outcome === "COMPLETED" && !isShortId(input.followUpEventId)) ||
        (input.outcome === "DISMISSED" && input.followUpEventId !== undefined)) {
      return NextResponse.json({ error: "invalid_closure" }, { status: 400 });
    }
    await assertScopedCoachLearner(access, scope, input.learnerId, commerceEnrollments);
    let verifiedRecordedAt: string | undefined;
    if (input.outcome === "COMPLETED") {
      const events = await learningStoreForScope(scope).listEvents(input.learnerId, 50);
      const followup = events.find((e) => e.id === input.followUpEventId) as Record<string, unknown> | undefined;
      if (!followup || typeof followup.recordedAt !== "string") {
        return NextResponse.json({ error: "verified_followup_event_required" }, { status: 409 });
      }
      verifiedRecordedAt = followup.recordedAt;
    }
    const record = await store.close(scope, teacherUid, input.learnerId,
      input.interventionId, 1, input.outcome as "COMPLETED" | "DISMISSED",
      input.outcome === "COMPLETED" ? input.followUpEventId as string : undefined,
      verifiedRecordedAt);
    return NextResponse.json({ intervention: record });
  } catch (error) { return pilotError(error); }
}
