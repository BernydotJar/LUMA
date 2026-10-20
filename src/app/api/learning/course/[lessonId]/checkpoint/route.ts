import { NextResponse } from "next/server";
import { courseDeliveryStore } from "@/lib/course-delivery-server";
import { courseError, courseNoStoreHeaders, requireAuthorizedCourse } from "@/lib/course-route-auth";

export const runtime = "nodejs";

/** Playback checkpoints are learner self-reports; never graded learning outcomes. */
export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { learner, scope } = await requireAuthorizedCourse(request);
    const { lessonId } = await params;
    const input = await request.json() as { lessonRevision?: unknown; positionUnit?: unknown; writeId?: unknown };
    if (!Number.isInteger(input.lessonRevision) || !Number.isInteger(input.positionUnit) ||
        typeof input.writeId !== "string") {
      return NextResponse.json({ error: "invalid_course_request" }, { status: 400, headers: courseNoStoreHeaders });
    }
    const result = await courseDeliveryStore(scope).saveCheckpoint(learner.uid, lessonId, {
      lessonRevision: input.lessonRevision as number,
      positionUnit: input.positionUnit as number,
      writeId: input.writeId,
    });
    return NextResponse.json({ ...result, authority: "consumption-only" }, { headers: courseNoStoreHeaders });
  } catch (error) { return courseError(error); }
}
