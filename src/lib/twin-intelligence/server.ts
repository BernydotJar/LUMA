import { NextResponse } from "next/server";
import type { LearningScope } from "@/lib/learning-entitlement";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { requireLearningCoachAccess } from "@/lib/learning-server";
import { resolveCoachLearningScope } from "@/lib/coach-scoped-learning";
import type { LearningCoachAccess } from "@/lib/coach-access";
import { assertPilotTeacher } from "./contracts";

export async function pilotTeacherContext(request: Request): Promise<{
  scope: LearningScope;
  teacherUid: string;
  access: LearningCoachAccess;
}> {
  const { decoded, access } = await requireLearningCoachAccess(request);
  const scope = resolveCoachLearningScope(access, request.headers);
  // Authenticated coach alone is not enough: exactly one named teacher,
  // explicitly assigned to this tenant and program.
  if (!scope) throw new Error("TWIN_PILOT_SCOPE_FORBIDDEN");
  assertPilotTeacher(decoded.uid, access.tenantIds, scope);
  return { scope, teacherUid: decoded.uid, access };
}

export async function readPilotJson(request: Request, maxBytes = 10_240): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) {
    throw new Error("TWIN_PILOT_PAYLOAD_TOO_LARGE");
  }
  if (!request.body) throw new Error("TWIN_PILOT_INVALID_JSON");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("TWIN_PILOT_PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
  } catch {
    throw new Error("TWIN_PILOT_INVALID_JSON");
  }
}

export function pilotError(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  if (code === "TWIN_PILOT_DISABLED") {
    return NextResponse.json({ error: "feature_unavailable" }, { status: 404 });
  }
  if ([
    "COACH_REQUIRED", "COACH_SCOPE_REQUIRED", "COACH_LEARNER_SCOPE_FORBIDDEN",
    "TWIN_INTERVENTION_SCOPE_FORBIDDEN", "TWIN_PILOT_SCOPE_FORBIDDEN",
    "TWIN_PILOT_TEACHER_FORBIDDEN", "LEARNING_ACTIVE_ENTITLEMENT_REQUIRED",
  ].includes(code)) {
    return NextResponse.json({ error: "pilot_scope_forbidden" }, { status: 403 });
  }
  if (code === "TWIN_PILOT_INVALID_JSON" || code === "TWIN_DRAFT_INVALID" ||
      code === "TWIN_APPROVAL_INVALID" ||
      code === "TWIN_INTERVENTION_INPUT_INVALID") {
    return NextResponse.json({ error: "invalid_pilot_request" }, { status: 400 });
  }
  if (code === "TWIN_PILOT_PAYLOAD_TOO_LARGE") {
    return NextResponse.json({ error: "request_too_large" }, { status: 413 });
  }
  if (code === "TWIN_DRAFT_REVISION_CONFLICT" ||
      code === "TWIN_APPROVAL_STALE_OR_UNTRUSTED" ||
      code === "TWIN_INTERVENTION_IDEMPOTENCY_CONFLICT" ||
      code === "TWIN_INTERVENTION_REVISION_CONFLICT" ||
      code === "TWIN_INTERVENTION_ALREADY_CLOSED" ||
      code === "TWIN_INTERVENTION_FOLLOWUP_NOT_LATER") {
    return NextResponse.json({ error: "revision_conflict" }, { status: 409 });
  }
  if (code === "TWIN_DRAFT_NOT_FOUND" || code === "LEARNER_NOT_FOUND" ||
      code === "TWIN_INTERVENTION_NOT_FOUND") {
    return NextResponse.json({ error: "record_not_found" }, { status: 404 });
  }
  return NextResponse.json({ error: "pilot_unavailable" }, { status: 503 });
}
