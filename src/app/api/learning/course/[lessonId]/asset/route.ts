import { NextResponse } from "next/server";
import { courseDeliveryStore, signAuthorizedCourseMedia } from "@/lib/course-delivery-server";
import { courseError, courseNoStoreHeaders, requireAuthorizedCourse } from "@/lib/course-route-auth";

export const runtime = "nodejs";

/** Server-signed, short-lived GCS URL; never a raw/public Google Drive link. */
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const { scope } = await requireAuthorizedCourse(request);
    const { lessonId } = await params;
    const lesson = await courseDeliveryStore(scope).getLesson(lessonId);
    if (!lesson) return NextResponse.json({ error: "lesson_not_available" }, {
      status: 404, headers: courseNoStoreHeaders,
    });
    const signed = await signAuthorizedCourseMedia(lesson);
    return NextResponse.json(signed, { headers: courseNoStoreHeaders });
  } catch (error) { return courseError(error); }
}
