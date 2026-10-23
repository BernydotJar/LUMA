import { NextResponse } from "next/server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { learningAccessFailure } from "@/lib/learning-entitlement";
import { requireLearningEntitlement } from "@/lib/learning-entitlement-server";
import { learningStoreForScope, requireLearningUser } from "@/lib/learning-server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { loadPublishedProgramAssessment } from "@/lib/program-assessment-registry";
import {
  evaluateProgramEntryAssessment,
  getProgramEntryQuestions,
} from "@/lib/program-assessment";

export const runtime = "nodejs";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const denied = learningAccessFailure(error);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
  if (message === "LEARNER_NOT_FOUND") {
    return NextResponse.json({ error: "create_learning_profile_first" }, { status: 409 });
  }
  if (message === "ENTRY_ASSESSMENT_RECENTLY_COMPLETED") {
    return NextResponse.json({ error: "entry_assessment_recently_completed" }, { status: 429 });
  }
  if (message === "ASSESSMENT_NOT_PUBLISHED" || message === "ASSESSMENT_REGISTRY_CHANGED") {
    return NextResponse.json({ error: message === "ASSESSMENT_NOT_PUBLISHED"
      ? "assessment_not_published" : "assessment_version_changed" }, { status: 409 });
  }
  return NextResponse.json({ error: "entry_assessment_unavailable" }, { status: 503 });
}

async function authorizedLearner(request: Request) {
  const identity = await requireLearningUser(request, { checkRevoked: true });
  const scope = await requireLearningEntitlement(identity, request.headers.get("x-luma-program-id"));
  const store = learningStoreForScope(scope);
  const learner = await store.get(identity.uid);
  if (!learner) throw new Error("LEARNER_NOT_FOUND");
  if (!scope) throw new Error("ASSESSMENT_NOT_PUBLISHED");
  const approved = await loadPublishedProgramAssessment(firebaseAdminFirestore, scope);
  if (!approved) throw new Error("ASSESSMENT_NOT_PUBLISHED");
  return { identity, store, learner, approved };
}

export async function GET(request: Request) {
  try {
    const { learner, approved } = await authorizedLearner(request);
    return NextResponse.json({
      version: approved.version,
      curriculumRevision: approved.curriculumRevision,
      questions: getProgramEntryQuestions(approved),
      summary: learner.record.entryAssessment ?? null,
      recommendationActive: learner.record.entryAssessmentActive ?? false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  // Bound unaudited client input before loading enrollment or learner state.
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return NextResponse.json({ error: "invalid_entry_assessment" }, { status: 400 });
  }
  let submitted: unknown;
  try {
    const text = await request.text();
    if (text.length > 4096) throw new Error("INVALID_SIZE");
    submitted = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_entry_assessment" }, { status: 400 });
  }
  if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
    return NextResponse.json({ error: "invalid_entry_assessment" }, { status: 400 });
  }
  const body = submitted as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["eventId", "version", "answers"].includes(key))) {
    return NextResponse.json({ error: "invalid_entry_assessment" }, { status: 400 });
  }
  const eventId = typeof body.eventId === "string" ? body.eventId : "";
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(eventId)) {
    return NextResponse.json({ error: "invalid_entry_assessment" }, { status: 400 });
  }
  try {
    const { identity, store, learner, approved } = await authorizedLearner(request);
    // Questions are bound to the currently published version. A stale client
    // cannot silently submit against a new syllabus.
    if (body.version !== approved.version) {
      return NextResponse.json({ error: "assessment_version_changed" }, { status: 409 });
    }
    const summary = evaluateProgramEntryAssessment(body.answers, new Date().toISOString(), approved);
    if (!summary) {
      return NextResponse.json({ error: "invalid_entry_assessment" }, { status: 400 });
    }
    // A submitted diagnosis cannot become a source of mastery. Subsequent
    // scored evidence controls the normal next-best-action engine.
    const lastAt = learner.record.entryAssessment?.completedAt;
    if (lastAt && Date.now() - Date.parse(lastAt) < 60_000) {
      if (learner.record.lastEventId === eventId) {
        return NextResponse.json({ summary: learner.record.entryAssessment, plan: learner.plan, duplicate: true });
      }
      return NextResponse.json({
        error: "entry_assessment_recently_completed",
        plan: learner.plan,
      }, { status: 429 });
    }
    const result = await store.appendEvent(identity.uid, eventId, {
      type: "PROGRAM_ENTRY_ASSESSMENT_COMPLETED",
      completedAt: summary.completedAt,
      sourceId: approved.version,
      evidenceCategory: "observed",
      twinAuthority: "none",
      answers: body.answers as Record<string, string>,
      programAssessment: summary,
    });
    return NextResponse.json({
      summary: result.record.entryAssessment,
      plan: result.plan,
      duplicate: result.duplicate,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
