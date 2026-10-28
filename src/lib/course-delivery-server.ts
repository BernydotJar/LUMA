import { getStorage } from "firebase-admin/storage";
import { firebaseAdminFirestore } from "./firebase-admin";
import type { LearningScope } from "./learning-entitlement";
import { FirestoreCourseDeliveryStore, type CourseLessonManifest } from "./course-delivery";

export function courseDeliveryStore(scope: LearningScope): FirestoreCourseDeliveryStore {
  return new FirestoreCourseDeliveryStore(firebaseAdminFirestore, scope);
}

/** Two-hour window covers pausing/seeking and later PDF range requests.
 * Reuse requires a fresh JWT + entitlement if the learner requests another URL.
 * Like all signed URLs, this one remains a bearer capability until expiry;
 * revoking a purchase prevents new issuance but not use of an issued URL.
 */
export const COURSE_MEDIA_URL_TTL_MS = 2 * 60 * 60 * 1000;

/** No media URL exists until security has explicitly confirmed private GCS IAM. */
export function privateCourseMediaConfigured(env: Record<string, string | undefined>) {
  const bucket = env.LUMA_COURSE_MEDIA_BUCKET?.trim() ?? "";
  return env.LUMA_COURSE_STORAGE_PRIVATE_CONFIRMED === "true" &&
    /^[a-z0-9][a-z0-9._-]{1,220}$/.test(bucket) ? bucket : null;
}

export async function signAuthorizedCourseMedia(manifest: CourseLessonManifest): Promise<{
  url: string; expiresAt: string; contentType: string;
}> {
  const bucket = privateCourseMediaConfigured(process.env);
  if (!bucket) throw new Error("COURSE_MEDIA_NOT_CONFIGURED");
  const expires = Date.now() + COURSE_MEDIA_URL_TTL_MS;
  // Every call must run after JWT, active enrollment and publication checks.
  // URLs are time-limited and never persisted or returned in catalog APIs.
  const [url] = await getStorage().bucket(bucket).file(manifest.mediaObjectName)
    .getSignedUrl({ version: "v4", action: "read", expires, responseDisposition: "inline" });
  if (!url.startsWith("https://")) throw new Error("COURSE_MEDIA_SIGNING_FAILED");
  return { url, expiresAt: new Date(expires).toISOString(), contentType: manifest.mediaContentType };
}
