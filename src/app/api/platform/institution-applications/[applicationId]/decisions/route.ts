import { academyApprovalStore } from "@/lib/institutions/review-server";
import { parseOperatorDecision } from "@/lib/institutions/approval-policy";
import { approvalEnabled, approvalError, boundedJson, platformOperator, reply } from "@/lib/institutions/approval-http";
export const runtime = "nodejs";
type Context = { params: Promise<{ applicationId: string }> };
export async function POST(request: Request, context: Context) {
  if (!approvalEnabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    const actor = await platformOperator(request);
    const decision = parseOperatorDecision(await boundedJson(request));
    const applicationId = (await context.params).applicationId;
    const result = await academyApprovalStore.review(applicationId, actor.uid, decision);
    return reply(result, decision.action === "invite" || decision.action === "reissue" ? 201 : 200);
  } catch (error) { return approvalError(error); }
}
