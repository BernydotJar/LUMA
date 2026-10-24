import { NextResponse } from "next/server";
import { publicLesson } from "@/lib/course-delivery";
import { courseDeliveryStore } from "@/lib/course-delivery-server";
import { courseError, courseNoStoreHeaders, requireAuthorizedCourse } from "@/lib/course-route-auth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { learner, scope } = await requireAuthorizedCourse(request);
    const { lessonId } = await params;
    const store = courseDeliveryStore(scope);
    const lesson = await store.getLesson(lessonId);
    if (!lesson) return NextResponse.json({ error: "lesson_not_available" }, {
      status: 404, headers: courseNoStoreHeaders,
    });
    return NextResponse.json({ lesson: publicLesson(lesson), checkpoint: await store.getCheckpoint(learner.uid, lessonId) }, {
      headers: courseNoStoreHeaders,
    });
  } catch (error) { return courseError(error); }
}
