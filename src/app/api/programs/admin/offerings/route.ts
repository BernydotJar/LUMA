import { FieldPath } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { requireLearningAdmin } from "@/lib/learning-server";
import { assertTenantAdmin } from "@/lib/tenant-admin-access";
import { programDeliveryStore } from "@/lib/program-delivery-server";
import type {
  ProgramDeliveryMode, ProgramOffering, ProgramOfferingStatus,
} from "@/lib/program-delivery";

export const runtime = "nodejs";

const deliveryModes = new Set<ProgramDeliveryMode>(["asynchronous", "live", "hybrid"]);
const statuses = new Set<ProgramOfferingStatus>(["draft", "active", "completed", "archived"]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 180) {
    throw new Error("INVALID_" + label.toUpperCase());
  }
  return value.trim();
}
function responseForError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return NextResponse.json({ error:
    code === "AUTH_REQUIRED" ? "authentication_required" :
    code === "ADMIN_REQUIRED" || code === "TENANT_ADMIN_FORBIDDEN" ||
    code === "TENANT_ADMIN_REQUIRED" ? "not_authorized" :
    code === "TENANT_ADMIN_SCOPE_INVALID" ? "invalid_tenant" :
    "invalid_program_offering",
  }, { status: code === "AUTH_REQUIRED" ? 401 :
      ["ADMIN_REQUIRED", "TENANT_ADMIN_FORBIDDEN", "TENANT_ADMIN_REQUIRED"].includes(code) ? 403 : 400,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  try {
    const admin = await requireLearningAdmin(request);
    const url = new URL(request.url);
    const tenantId = text(url.searchParams.get("tenantId"), "tenant_id");
    assertTenantAdmin(admin as Record<string, unknown>, tenantId);
    const rawLimit = url.searchParams.get("limit");
    const limit = rawLimit === null ? 50 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return NextResponse.json({ error: "invalid_page_limit" }, { status: 400 });
    }
    const cursor = url.searchParams.get("cursor") || undefined;
    if (cursor && !/^[a-f0-9]{64}$/.test(cursor)) {
      return NextResponse.json({ error: "invalid_page_cursor" }, { status: 400 });
    }
    let query = firebaseAdminFirestore.collection("programOfferings")
      .where("tenantId", "==", tenantId)
      .orderBy(FieldPath.documentId(), "asc")
      .limit(limit + 1);
    if (cursor) query = query.startAfter(cursor);
    const snapshots = await query.get();
    const documents = snapshots.docs.slice(0, limit);
    const offerings = documents.map(document => document.data() as ProgramOffering)
      .filter(offering => offering.tenantId === tenantId);
    return NextResponse.json({
      offerings, nextCursor: snapshots.size > limit ? documents.at(-1)?.id ?? null : null,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return responseForError(error); }
}

export async function POST(request: Request) {
  try {
    const admin = await requireLearningAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const tenantId = text(body.tenantId, "tenant_id");
    assertTenantAdmin(admin as Record<string, unknown>, tenantId);
    const deliveryMode = text(body.deliveryMode, "delivery_mode") as ProgramDeliveryMode;
    if (!deliveryModes.has(deliveryMode)) {
      return NextResponse.json({ error: "invalid_delivery_mode" }, { status: 400 });
    }
    const status = body.status === undefined ? "draft" :
      text(body.status, "status") as ProgramOfferingStatus;
    if (!statuses.has(status)) {
      return NextResponse.json({ error: "invalid_offering_status" }, { status: 400 });
    }
    if (body.coachIds !== undefined &&
        (!Array.isArray(body.coachIds) || body.coachIds.length > 30 ||
         body.coachIds.some(id => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)))) {
      return NextResponse.json({ error: "invalid_coach_ids" }, { status: 400 });
    }
    const offering = await programDeliveryStore.upsertOffering({
      tenantId,
      programId: text(body.programId, "program_id"),
      cohortKey: text(body.cohortKey, "cohort_key"),
      title: text(body.title, "title"),
      deliveryMode,
      timezone: text(body.timezone, "timezone"),
      status, ...(body.coachIds ? { coachIds: body.coachIds as string[] } : {}),
    });
    return NextResponse.json({ offering }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) { return responseForError(error); }
}
