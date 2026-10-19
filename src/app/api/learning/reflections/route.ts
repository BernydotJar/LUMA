import { NextResponse } from "next/server";
import { learningStoreForScope, requireLearningUser } from "@/lib/learning-server";
import { requireLearningEntitlement } from "@/lib/learning-entitlement-server";
import { learningAccessFailure } from "@/lib/learning-entitlement";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { learningExperiences } from "@/lib/learning-content";

export const runtime = "nodejs";

function selectedExperience(id: unknown) {
  return typeof id === "string" ? learningExperiences.find((x) => x.id === id) : undefined;
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  const access = learningAccessFailure(error);
  return access
    ? NextResponse.json({ error: access.error }, { status: access.status })
    : NextResponse.json({ error: "reflection_unavailable" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const scope = await requireLearningEntitlement(user, request.headers.get("x-luma-program-id"));
    const experience = selectedExperience(new URL(request.url).searchParams.get("experienceId"));
    if (!experience) return NextResponse.json({ error: "unknown_experience" }, { status: 400 });
    const reflection = await learningStoreForScope(scope).getReflection(user.uid, experience.id);
    return NextResponse.json({ reflection }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const scope = await requireLearningEntitlement(user, request.headers.get("x-luma-program-id"));
    const data = await request.json() as { experienceId?: unknown; response?: unknown };
    const experience = selectedExperience(data.experienceId);
    const response = typeof data.response === "string" ? data.response.trim() : "";
    if (!experience || response.length < 25 || response.length > 2500) {
      return NextResponse.json({ error: "invalid_reflection" }, { status: 400 });
    }
    const reflection = await learningStoreForScope(scope).saveReflection(
      user.uid, experience.id, experience.sourceId, response,
    );
    return NextResponse.json({ reflection }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
