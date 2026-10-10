import { NextResponse } from "next/server";
import { institutionDraftStore } from "@/lib/institution-config-server";
import {
  parseDraftBrandInput,
  parseDraftCreateInput,
  parseDraftTenantId,
} from "@/lib/institutions/draft-input";
import { requireLearningAdmin } from "@/lib/learning-server";
import { isPlatformSuperuser } from "@/lib/tenant-admin-access";
import { assertInstitutionDraftAdmin } from "@/lib/institutions/draft-access";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ tenantId: string }> };
const headers = { "cache-control": "private, no-store" };
const MAX_BODY_BYTES = 8192;

function response(data: object, status: number) {
  return NextResponse.json(data, { status, headers });
}

function enabled(): boolean {
  // This remains off in every existing deployment unless deliberately enabled.
  return process.env.LUMA_INSTITUTION_DRAFT_ADMIN_ENABLED === "true";
}

async function bodyWithLimit(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^application\/json(?:\s*;|$)/.test(type)) {
    throw new Error("INSTITUTION_DRAFT_MEDIA_TYPE_INVALID");
  }
  const length = request.headers.get("content-length");
  if (length && Number.isFinite(Number(length)) && Number(length) > MAX_BODY_BYTES) {
    throw new Error("INSTITUTION_DRAFT_BODY_TOO_LARGE");
  }
  if (!request.body) throw new Error("INSTITUTION_DRAFT_PAYLOAD_INVALID");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let lengthRead = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      lengthRead += value.byteLength;
      if (lengthRead > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("INSTITUTION_DRAFT_BODY_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("INSTITUTION_DRAFT_PAYLOAD_INVALID");
  }
}

function routeError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const firebaseCode = error && typeof error === "object" && "code" in error ?
    (error as { code?: unknown }).code : undefined;
  if (code === "AUTH_REQUIRED" ||
      (typeof firebaseCode === "string" && firebaseCode.startsWith("auth/"))) {
    return response({ error: "authentication_required" }, 401);
  }
  if (["ADMIN_REQUIRED", "TENANT_ADMIN_REQUIRED", "TENANT_ADMIN_FORBIDDEN",
       "INSTITUTION_DRAFT_ADMIN_REQUIRED", "INSTITUTION_DRAFT_ADMIN_SCOPE_REQUIRED",
       "INSTITUTION_DRAFT_ADMIN_FORBIDDEN"].includes(code)) {
    return response({ error: "not_authorized" }, 403);
  }
  if (code === "INSTITUTION_DRAFT_NOT_FOUND") return response({ error: "draft_not_found" }, 404);
  if (["INSTITUTION_DRAFT_REQUEST_REUSE_CONFLICT", "INSTITUTION_DRAFT_VERSION_CONFLICT", "INSTITUTION_DRAFT_ALREADY_EXISTS"].includes(code)) {
    return response({ error: "draft_conflict" }, 409);
  }
  if (code === "INSTITUTION_DRAFT_BODY_TOO_LARGE") return response({ error: "request_too_large" }, 413);
  if (code === "INSTITUTION_DRAFT_MEDIA_TYPE_INVALID") return response({ error: "json_required" }, 415);
  if (code.startsWith("INSTITUTION_DRAFT_") &&
      !["INSTITUTION_DRAFT_CORRUPT", "INSTITUTION_DRAFT_UPDATE_INVALID"].includes(code)) {
    return response({ error: "invalid_draft_input" }, 400);
  }
  if (code === "TENANT_ADMIN_SCOPE_INVALID") return response({ error: "invalid_tenant" }, 400);
  // Never expose Firestore/IAM errors to clients as input errors or zero-data fallbacks.
  return response({ error: "draft_service_unavailable" }, 503);
}

export async function GET(request: Request, context: RouteContext) {
  if (!enabled()) return response({ error: "feature_unavailable" }, 503);
  try {
    const admin = await requireLearningAdmin(request);
    const tenantId = parseDraftTenantId((await context.params).tenantId);
    assertInstitutionDraftAdmin(admin as Record<string, unknown>, tenantId);
    const draft = await institutionDraftStore.getDraftForTenant(tenantId);
    if (!draft) return response({ error: "draft_not_found" }, 404);
    return response({
      draft: {
        config: draft.config,
        status: draft.status,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
      },
    }, 200);
  } catch (error) { return routeError(error); }
}

export async function POST(request: Request, context: RouteContext) {
  if (!enabled()) return response({ error: "feature_unavailable" }, 503);
  try {
    const admin = await requireLearningAdmin(request);
    if (!isPlatformSuperuser(admin as Record<string, unknown>)) {
      return response({ error: "not_authorized" }, 403);
    }
    const tenantId = parseDraftTenantId((await context.params).tenantId);
    const parsed = parseDraftCreateInput(tenantId, await bodyWithLimit(request));
    const result = await institutionDraftStore.createDraft(parsed, admin.uid);
    return response(result, result.duplicate ? 200 : 201);
  } catch (error) { return routeError(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  if (!enabled()) return response({ error: "feature_unavailable" }, 503);
  try {
    const admin = await requireLearningAdmin(request);
    const tenantId = parseDraftTenantId((await context.params).tenantId);
    assertInstitutionDraftAdmin(admin as Record<string, unknown>, tenantId);
    const parsed = parseDraftBrandInput(tenantId, await bodyWithLimit(request));
    const result = await institutionDraftStore.updateDraftBrand(parsed, admin.uid);
    return response(result, 200);
  } catch (error) { return routeError(error); }
}
