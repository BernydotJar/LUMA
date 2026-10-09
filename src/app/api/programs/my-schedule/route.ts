import { NextResponse } from "next/server";
import { commerceEnrollments } from "@/lib/commerce/server";
import { requireLearningUser } from "@/lib/learning-server";
import { programDeliveryStore } from "@/lib/program-delivery-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const email = typeof user.email === "string" ? user.email.trim().toLowerCase() : "";

    if (email && user.email_verified === true) {
      await commerceEnrollments.claimByEmail(user.uid, email);
    }

    const enrollments = await commerceEnrollments.listByLearner(user.uid);
    const activePrograms = enrollments
      .filter((record) => record.status === "active")
      .map((record) => ({
        tenantId: record.tenantId,
        programId: record.programId,
      }));

    const schedule = await programDeliveryStore.upcomingForPrograms(activePrograms);

    return NextResponse.json({
      schedule: schedule.map(({ offering, session }) => ({
        offeringId: offering.offeringId,
        programId: offering.programId,
        offeringTitle: offering.title,
        deliveryMode: offering.deliveryMode,
        timezone: offering.timezone,
        session,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    }
    return NextResponse.json({ error: "program_schedule_unavailable" }, { status: 500 });
  }
}
