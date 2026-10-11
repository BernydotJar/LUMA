import { NextResponse } from "next/server";
import { requireLearningAdmin } from "@/lib/learning-server";
import { isPlatformSuperuser } from "@/lib/tenant-admin-access";
import { parseDraftTenantId } from "@/lib/institutions/draft-input";
import { parsePreparePlanInput, parseReviewPlanInput } from "@/lib/institutions/publication-plan-input";
import { publicationPlanStore } from "@/lib/institutions/publication-plan-server";

export const runtime = "nodejs";
type Context = { params: Promise<{ tenantId: string }> };
const maxBodyBytes = 4096;
const headers = { "cache-control": "private, no-store" };
const reply = (body: object, status: number) => NextResponse.json(body, { status, headers });

async function jsonWithLimit(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^application\/json(?:\s*;|$)/.test(type)) throw new Error("INSTITUTION_PLAN_MEDIA_TYPE_INVALID");
  if (!request.body) throw new Error("INSTITUTION_PLAN_PAYLOAD_INVALID");
  const length = request.headers.get("content-length");
  if (length && Number.isFinite(Number(length)) && Number(length) > maxBodyBytes) {
    throw new Error("INSTITUTION_PLAN_BODY_TOO_LARGE");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBodyBytes) {
        await reader.cancel();
        throw new Error("INSTITUTION_PLAN_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("INSTITUTION_PLAN_PAYLOAD_INVALID");
  }
}

function errorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const authCode = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code : undefined;
  if (code === "AUTH_REQUIRED" || (typeof authCode === "string" && authCode.startsWith("auth/"))) {
    return reply({ error: "authentication_required" }, 401);
  }
  if (code === "ADMIN_REQUIRED" || code === "INSTITUTION_PLAN_SELF_REVIEW_FORBIDDEN") {
    return reply({ error: "not_authorized" }, 403);
  }
  if (code === "INSTITUTION_PLAN_NOT_FOUND") return reply({ error: "plan_not_found" }, 404);
  if (code === "INSTITUTION_PREFLIGHT_DRAFT_NOT_FOUND") return reply({ error: "draft_not_found" }, 404);
  if (["INSTITUTION_PLAN_REQUEST_REUSE_CONFLICT", "INSTITUTION_PLAN_VERSION_CONFLICT",
    "INSTITUTION_PLAN_ALREADY_OPEN", "INSTITUTION_PLAN_STATE_CONFLICT",
    "INSTITUTION_PLAN_READINESS_CHANGED", "INSTITUTION_PLAN_DRAFT_CHANGED"].includes(code)) {
    return reply({ error: "plan_conflict" }, 409);
  }
  if (code === "INSTITUTION_PLAN_BODY_TOO_LARGE") return reply({ error: "request_too_large" }, 413);
  if (code === "INSTITUTION_PLAN_MEDIA_TYPE_INVALID") return reply({ error: "json_required" }, 415);
  if (code === "INSTITUTION_DRAFT_TENANT_INVALID" ||
      (code.startsWith("INSTITUTION_PLAN_") &&
       !["INSTITUTION_PLAN_CORRUPT", "INSTITUTION_PLAN_REVISION_EXHAUSTED",
         "INSTITUTION_PLAN_TRANSITION_INVALID"].includes(code))) {
    return reply({ error: "invalid_plan_input" }, 400);
  }
  return reply({ error: "plan_service_unavailable" }, 503);
}

async function verifiedSuperuser(request: Request): Promise<string> {
  const admin = await requireLearningAdmin(request);
  if (!isPlatformSuperuser(admin as Record<string, unknown>)) {
    throw new Error("ADMIN_REQUIRED");
  }
  return admin.uid;
}

/** Read a nonactivating publication plan. Never resolves an active tenant. */
export async function GET(request: Request, context: Context) {
  if (process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED !== "true") {
    return reply({ error: "feature_unavailable" }, 503);
  }
  try {
    await verifiedSuperuser(request);
    const tenantId = parseDraftTenantId((await context.params).tenantId);
    const plan = await publicationPlanStore.getPlanForTenant(tenantId);
    return plan ? reply({ plan }, 200) : reply({ error: "plan_not_found" }, 404);
  } catch (error) { return errorResponse(error); }
}

/** Stages a plan only; the preflight is re-read on every new attempt. */
export async function POST(request: Request, context: Context) {
  if (process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED !== "true") {
    return reply({ error: "feature_unavailable" }, 503);
  }
  try {
    const uid = await verifiedSuperuser(request);
    const tenantId = parseDraftTenantId((await context.params).tenantId);
    const input = parsePreparePlanInput(tenantId, await jsonWithLimit(request));
    const result = await publicationPlanStore.prepare(input, uid);
    return reply({ receipt: result }, result.duplicate ? 200 : 201);
  } catch (error) { return errorResponse(error); }
}

/** Review must use another UID; withdrawal is emergency-safe and auditable. */
export async function PATCH(request: Request, context: Context) {
  if (process.env.LUMA_INSTITUTION_PLAN_ADMIN_ENABLED !== "true") {
    return reply({ error: "feature_unavailable" }, 503);
  }
  try {
    const uid = await verifiedSuperuser(request);
    const tenantId = parseDraftTenantId((await context.params).tenantId);
    const input = parseReviewPlanInput(tenantId, await jsonWithLimit(request));
    const result = await publicationPlanStore.transition(input, uid);
    return reply({ receipt: result }, 200);
  } catch (error) { return errorResponse(error); }
}
