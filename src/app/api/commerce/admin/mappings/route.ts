import { NextResponse } from "next/server";
import { commerceMappings } from "@/lib/commerce/server";
import { requireLearningAdmin } from "@/lib/learning-server";

export const runtime = "nodejs";

function stringField(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`INVALID_${label.toUpperCase()}`);
  }
  return value.trim();
}

function authError(message: string) {
  if (message === "AUTH_REQUIRED") {
    return NextResponse.json(
      { error: "authentication_required" },
      { status: 401 },
    );
  }
  if (message === "ADMIN_REQUIRED") {
    return NextResponse.json(
      { error: "admin_role_required" },
      { status: 403 },
    );
  }
  return undefined;
}

export async function GET(request: Request) {
  try {
    await requireLearningAdmin(request);
    const params = new URL(request.url).searchParams;
    const rawLimit = params.get("limit");
    const limit = rawLimit === null ? 100 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 250) {
      return NextResponse.json({ error: "invalid_page_limit" }, { status: 400 });
    }
    const cursor = params.get("cursor") ?? undefined;
    if (cursor && !/^[a-f0-9]{64}$/.test(cursor)) {
      return NextResponse.json({ error: "invalid_page_cursor" }, { status: 400 });
    }
    const page = await commerceMappings.listPage(limit, cursor);
    return NextResponse.json(page);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN";
    return (
      authError(message) ??
      NextResponse.json(
        { error: "commerce_mappings_unavailable" },
        { status: 500 },
      )
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireLearningAdmin(request);
    const body = (await request.json()) as Record<string, unknown>;
    const provider = stringField(body.provider, "provider");
    if (provider !== "hotmart" && provider !== "stripe") {
      return NextResponse.json(
        { error: "unsupported_commerce_provider" },
        { status: 400 },
      );
    }

    const mapping = await commerceMappings.upsert({
      provider,
      externalProductId: stringField(
        body.externalProductId,
        "externalProductId",
      ),
      tenantId: stringField(body.tenantId, "tenantId"),
      productId: stringField(body.productId, "productId"),
      programId: stringField(body.programId, "programId"),
      ...(body.offeringId === null || body.offeringId === ""
        ? { offeringId: null }
        : typeof body.offeringId === "string"
          ? { offeringId: body.offeringId.trim() } : {}),
      active:
        typeof body.active === "boolean"
          ? body.active
          : undefined,
    });

    return NextResponse.json({ mapping });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN";
    return (
      authError(message) ??
      NextResponse.json(
        { error: "invalid_commerce_mapping" },
        { status: 400 },
      )
    );
  }
}
