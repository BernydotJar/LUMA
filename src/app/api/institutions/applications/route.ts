import { NextResponse } from "next/server";
import { firebaseAdminFirestore } from "@/lib/firebase-admin";
import { requireLearningUser } from "@/lib/learning-server";
import { isRejectedFirebaseToken } from "@/lib/auth-token-error";
import { parseAcademyApplication } from "@/lib/institutions/application";
import { FirestoreAcademyApplicationStore } from "@/lib/institutions/application-store";
import { academyRequestThrottle } from "@/lib/institutions/request-throttle-server";

export const runtime = "nodejs";
const MAX_BYTES = 4096;
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };
const store = new FirestoreAcademyApplicationStore(firebaseAdminFirestore);
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers });
const enabled = () => process.env.LUMA_INSTITUTION_REQUESTS_ENABLED === "true";

async function verifiedApplicant(request: Request) {
  const token = await requireLearningUser(request, { checkRevoked: true });
  const email = typeof token.email === "string" ? token.email.trim().toLowerCase() : "";
  if (token.email_verified !== true || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("APPLICATION_VERIFIED_IDENTITY_REQUIRED");
  }
  return { uid: token.uid, email, email_verified: true as const };
}

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  if (code === "AUTH_REQUIRED" || isRejectedFirebaseToken(error)) return reply({ error: "authentication_required" }, 401);
  if (code === "APPLICATION_VERIFIED_IDENTITY_REQUIRED") return reply({ error: "verified_email_required" }, 403);
  if (code === "APPLICATION_INPUT_INVALID") return reply({ error: "invalid_application" }, 400);
  if (code === "APPLICATION_ALREADY_SUBMITTED") return reply({ error: "application_already_submitted" }, 409);
  if (code === "APPLICATION_MEDIA_TYPE_INVALID") return reply({ error: "json_required" }, 415);
  if (code === "APPLICATION_TOO_LARGE") return reply({ error: "request_too_large" }, 413);
  if (code === "APPLICATION_RATE_LIMITED") return reply({ error: "rate_limited" }, 429);
  return reply({ error: "application_service_unavailable" }, 503);
}

async function parseBoundedJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new Error("APPLICATION_MEDIA_TYPE_INVALID");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && Number.isFinite(Number(contentLength)) && Number(contentLength) > MAX_BYTES) {
    throw new Error("APPLICATION_TOO_LARGE");
  }
  if (!request.body) throw new Error("APPLICATION_INPUT_INVALID");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > MAX_BYTES) {
        await reader.cancel();
        throw new Error("APPLICATION_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new Error("APPLICATION_INPUT_INVALID"); }
}

export async function GET(request: Request) {
  if (!enabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    const identity = await verifiedApplicant(request);
    const application = await store.get(identity.uid);
    return reply({ application });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  if (!enabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    const identity = await verifiedApplicant(request);
    await academyRequestThrottle.consume(identity.uid, "application-submit");
    const input = parseAcademyApplication(await parseBoundedJson(request));
    const { application, duplicate } = await store.submit(identity, input);
    return reply({ application, duplicate }, duplicate ? 200 : 201);
  } catch (error) { return fail(error); }
}
