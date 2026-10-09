import { NextResponse } from "next/server";
import { commerceEnrollments } from "@/lib/commerce/server";
import { requireLearningUser } from "@/lib/learning-server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await requireLearningUser(request);
    const email =
      typeof user.email === "string"
        ? user.email.trim().toLowerCase()
        : "";

    if (!email || user.email_verified !== true) {
      return NextResponse.json(
        { error: "verified_email_required" },
        { status: 403 },
      );
    }

    const enrollments =
      await commerceEnrollments.claimByEmail(
        user.uid,
        email,
      );

    return NextResponse.json({
      learnerId: user.uid,
      enrollments: enrollments.map((record) => ({
        enrollmentId: record.enrollmentId,
        tenantId: record.tenantId,
        programId: record.programId,
        productId: record.productId,
        status: record.status,
        updatedAt: record.updatedAt,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN";
    if (message === "AUTH_REQUIRED") {
      return NextResponse.json(
        { error: "authentication_required" },
        { status: 401 },
      );
    }
    if (message === "ENROLLMENT_ALREADY_CLAIMED") {
      return NextResponse.json(
        { error: "enrollment_already_claimed" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "commerce_access_unavailable" },
      { status: 500 },
    );
  }
}
