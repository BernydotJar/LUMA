import { NextResponse } from "next/server";
import { requireLearningAdmin } from "@/lib/learning-server";
import { institutionalGrants } from "@/lib/commerce/institutional-grant-server";
import { authorizeInstitutionalAdmin } from "@/lib/commerce/institutional-grants";
import { institutionalGrantError } from "@/lib/commerce/institutional-grant-http";
import {
  MAX_INSTITUTIONAL_BODY_BYTES,
  parseInstitutionalBulkInput,
  runInstitutionalBulk,
} from "@/lib/commerce/institutional-bulk";

export const runtime = "nodejs";

/** A bounded, auditable admin batch — not an unofficial payment provider. */
export async function POST(request: Request) {
  try {
    // Authentication first: never parse/process institutional emails for anonymous callers.
    const admin = await requireLearningAdmin(request);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "json_required" }, { status: 415 });
    }
    const declared = Number(request.headers.get("content-length"));
    if (declared > MAX_INSTITUTIONAL_BODY_BYTES) {
      return NextResponse.json({ error: "batch_payload_too_large" }, { status: 413 });
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_INSTITUTIONAL_BODY_BYTES) {
      return NextResponse.json({ error: "batch_payload_too_large" }, { status: 413 });
    }
    let body: unknown;
    try { body = JSON.parse(rawBody); }
    catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    const input = parseInstitutionalBulkInput(body);
    authorizeInstitutionalAdmin(admin as Record<string, unknown>, input.shared.tenantId);
    const result = await runInstitutionalBulk(input, admin.uid, institutionalGrants);
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return institutionalGrantError(error);
  }
}
