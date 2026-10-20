import { afterEach, expect, test, vi } from "vitest";
const signing = vi.hoisted(() => ({ signed: vi.fn(async (_options: unknown) => ["https://storage.googleapis.com/private/lesson?signature=test"]) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({
  bucket: () => ({ file: () => ({ getSignedUrl: signing.signed }) }),
}) }));
import { COURSE_MEDIA_URL_TTL_MS, privateCourseMediaConfigured, signAuthorizedCourseMedia } from "./course-delivery-server";
import type { CourseLessonManifest } from "./course-delivery";

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); signing.signed.mockClear(); });

test("GCS signed media request expires two hours after issuance for later range reads", async () => {
  const issueTime = new Date("2026-10-20T15:00:00Z");
  vi.useFakeTimers(); vi.setSystemTime(issueTime);
  vi.stubEnv("LUMA_COURSE_MEDIA_BUCKET", "luma-paid-private");
  vi.stubEnv("LUMA_COURSE_STORAGE_PRIVATE_CONFIRMED", "true");
  const signed = await signAuthorizedCourseMedia({
    mediaObjectName: "lesson/approved.mp4", mediaContentType: "video/mp4",
  } as CourseLessonManifest);
  expect(COURSE_MEDIA_URL_TTL_MS).toBe(7_200_000);
  const expiry = issueTime.getTime() + COURSE_MEDIA_URL_TTL_MS;
  expect(signed.expiresAt).toBe(new Date(expiry).toISOString());
  expect(signing.signed).toHaveBeenCalledWith(expect.objectContaining({
    version: "v4", action: "read", responseDisposition: "inline", expires: expiry,
  }));
});

test("unconfirmed or invalid private GCS buckets never enable media signing", () => {
  expect(privateCourseMediaConfigured({ LUMA_COURSE_MEDIA_BUCKET: "luma-published-private", LUMA_COURSE_STORAGE_PRIVATE_CONFIRMED: "true" })).toBe("luma-published-private");
  expect(privateCourseMediaConfigured({ LUMA_COURSE_MEDIA_BUCKET: "luma-published-private" })).toBeNull();
  expect(privateCourseMediaConfigured({ LUMA_COURSE_MEDIA_BUCKET: "../public", LUMA_COURSE_STORAGE_PRIVATE_CONFIRMED: "true" })).toBeNull();
});
