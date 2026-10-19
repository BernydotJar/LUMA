import { academyApprovalStore } from "@/lib/institutions/review-server";
import { approvalEnabled, approvalError, platformOperator, reply } from "@/lib/institutions/approval-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!approvalEnabled()) return reply({ error: "feature_unavailable" }, 503);
  try {
    await platformOperator(request);
    const url = new URL(request.url);
    const raw = url.searchParams.get("limit");
    const limit = raw === null ? 20 : Number(raw);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    return reply(await academyApprovalStore.list(limit, cursor));
  } catch (error) { return approvalError(error); }
}
