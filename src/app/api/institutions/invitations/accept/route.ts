import { academyRequestThrottle } from "@/lib/institutions/request-throttle-server";
import { academyApprovalStore } from "@/lib/institutions/review-server";
import { applicantIdentity, approvalEnabled, approvalError, boundedJson, reply } from "@/lib/institutions/approval-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!approvalEnabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    const identity = await applicantIdentity(request);
    await academyRequestThrottle.consume(identity.uid, "invitation-accept");
    const input = await boundedJson(request);
    if (!input || typeof input !== "object" || Array.isArray(input) ||
        Object.getPrototypeOf(input) !== Object.prototype) throw new Error("REVIEW_INPUT_INVALID");
    const raw = input as Record<string, unknown>;
    if (Object.keys(raw).length !== 2 || typeof raw.applicationId !== "string" ||
        typeof raw.token !== "string") throw new Error("REVIEW_INPUT_INVALID");
    const application = await academyApprovalStore.accept(raw.applicationId, raw.token, identity);
    return reply({ application });
  } catch (error) { return approvalError(error); }
}
