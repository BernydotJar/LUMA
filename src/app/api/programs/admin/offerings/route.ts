import { NextResponse } from "next/server";
import { requireLearningAdmin } from "@/lib/learning-server";
import { programDeliveryStore } from "@/lib/program-delivery-server";
import type { ProgramDeliveryMode, ProgramOfferingStatus } from "@/lib/program-delivery";

export const runtime = "nodejs";

const deliveryModes = new Set<ProgramDeliveryMode>([
  "asynchronous",
  "live",
  "hybrid",
]);
const offeringStatuses = new Set<ProgramOfferingStatus>([
  "draft",
  "active",
  "completed",
  "archived",
]);

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`INVALID_${label.toUpperCase()}`);
  }
  return value.trim();
}

function authResponse(message: string) {
  if (message === "AUTH_REQUIRED") {
    return NextResponse.json({ error: "authentication_required" }, { status: 401 });
  }
  if (message === "ADMIN_REQUIRED") {
    return NextResponse.json({ error: "admin_role_required" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    await requireLearningAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const mode = text(body.deliveryMode, "deliveryMode") as ProgramDeliveryMode;
    if (!deliveryModes.has(mode)) {
      return NextResponse.json({ error: "invalid_delivery_mode" }, { status: 400 });
    }
    const status =
      typeof body.status === "string"
        ? (body.status as ProgramOfferingStatus)
        : undefined;
    if (status && !offeringStatuses.has(status)) {
      return NextResponse.json({ error: "invalid_offering_status" }, { status: 400 });
    }

    const offering = await programDeliveryStore.upsertOffering({
      tenantId: text(body.tenantId, "tenantId"),
      programId: text(body.programId, "programId"),
      cohortKey: text(body.cohortKey, "cohortKey"),
      title: text(body.title, "title"),
      deliveryMode: mode,
      timezone: text(body.timezone, "timezone"),
      ...(status ? { status } : {}),
      ...(Array.isArray(body.coachIds)
        ? { coachIds: body.coachIds.filter((value): value is string => typeof value === "string") }
        : {}),
    });

    return NextResponse.json({ offering });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    return (
      authResponse(message) ??
      NextResponse.json({ error: "invalid_program_offering" }, { status: 400 })
    );
  }
}
