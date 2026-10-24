import { NextResponse } from "next/server";
import { verifyClassroomMaintenanceCaller } from "@/lib/live-classroom-maintenance-auth";
import { runClassroomMaintenance } from "@/lib/live-classroom-maintenance-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google Cloud Scheduler OIDC only. No browser cookies or shared cron passwords. */
export async function POST(request: Request) {
  const authorization = await verifyClassroomMaintenanceCaller(request);
  if (!authorization.ok) {
    return NextResponse.json({ error: authorization.reason }, {
      status: authorization.status,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (process.env.LUMA_LIVE_CLASSROOM_ENABLED !== "true") {
    return NextResponse.json({ error: "classroom_not_enabled" }, { status: 503 });
  }
  try {
    const result = await runClassroomMaintenance();
    if (result.state === "partial_failure") console.warn("live_classroom_maintenance_attention", {
      checkedAt: result.checkedAt, retryableFailures: result.retryableFailures,
      limitReached: result.limitReached, processedDisconnects: result.processedDisconnects,
    });
    return NextResponse.json(result, {
      status: result.retryableFailures ? 503 : result.limitReached ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Internal failures are surfaced to scheduler as retryable, not falsely ACKed.
    return NextResponse.json({ error: "classroom_maintenance_retryable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
