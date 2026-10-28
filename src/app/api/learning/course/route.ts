import { NextResponse } from "next/server";
import { courseDeliveryStore } from "@/lib/course-delivery-server";
import { courseError, courseNoStoreHeaders, requireAuthorizedCourse } from "@/lib/course-route-auth";

export const runtime = "nodejs";

/** Only published, rights-approved lessons for the authenticated purchased program. */
export async function GET(request: Request) {
  try {
    const { learner, scope } = await requireAuthorizedCourse(request);
    const params = new URL(request.url).searchParams;
    const store = courseDeliveryStore(scope);
    const page = await store.listLessons(40, params.get("cursor"));
    const lessons = await Promise.all(page.lessons.map(async (lesson) => ({
      ...lesson,
      checkpoint: await store.getCheckpoint(learner.uid, lesson.lessonId),
    })));
    return NextResponse.json({ lessons, nextCursor: page.nextCursor, program: scope }, {
      headers: courseNoStoreHeaders,
    });
  } catch (error) { return courseError(error); }
}
