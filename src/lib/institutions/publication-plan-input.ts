import { parseDraftRequestId, parseDraftTenantId } from "./draft-input";

export type PlanReviewAction = "review" | "withdraw";
export type PlanWithdrawReason = "security-stop" | "evidence-stale" | "operator-withdrawn";

export interface PreparePlanInput {
  readonly tenantId: string;
  readonly requestId: string;
  readonly expectedPlanRevision: number;
  readonly expectedDraftVersion: number;
  readonly expectedReadinessDigest: string;
}

export interface ReviewPlanInput {
  readonly tenantId: string;
  readonly requestId: string;
  readonly expectedPlanRevision: number;
  readonly action: PlanReviewAction;
  readonly reasonCode: "reviewed-for-next-gate" | PlanWithdrawReason;
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).some(key => !keys.includes(key)) ||
      keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error("INSTITUTION_PLAN_UNEXPECTED_FIELD");
  }
}

function validRevision(value: unknown, min: number, code: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) throw new Error(code);
  return value as number;
}

export function parsePreparePlanInput(tenantId: string, input: unknown): PreparePlanInput {
  parseDraftTenantId(tenantId);
  if (!plainObject(input)) throw new Error("INSTITUTION_PLAN_PAYLOAD_INVALID");
  exactKeys(input, ["requestId", "expectedPlanRevision", "expectedDraftVersion", "expectedReadinessDigest"]);
  if (typeof input.expectedReadinessDigest !== "string" ||
      !/^[a-f0-9]{64}$/.test(input.expectedReadinessDigest)) {
    throw new Error("INSTITUTION_PLAN_DIGEST_INVALID");
  }
  return {
    tenantId,
    requestId: parseDraftRequestId(input.requestId),
    expectedPlanRevision: validRevision(input.expectedPlanRevision, 0, "INSTITUTION_PLAN_REVISION_INVALID"),
    expectedDraftVersion: validRevision(input.expectedDraftVersion, 1, "INSTITUTION_PLAN_DRAFT_VERSION_INVALID"),
    expectedReadinessDigest: input.expectedReadinessDigest,
  };
}

export function parseReviewPlanInput(tenantId: string, input: unknown): ReviewPlanInput {
  parseDraftTenantId(tenantId);
  if (!plainObject(input)) throw new Error("INSTITUTION_PLAN_PAYLOAD_INVALID");
  exactKeys(input, ["requestId", "expectedPlanRevision", "action", "reasonCode"]);
  if (input.action !== "review" && input.action !== "withdraw") {
    throw new Error("INSTITUTION_PLAN_ACTION_INVALID");
  }
  if (input.action === "review" && input.reasonCode !== "reviewed-for-next-gate") {
    throw new Error("INSTITUTION_PLAN_REASON_INVALID");
  }
  if (input.action === "withdraw" &&
      !["security-stop", "evidence-stale", "operator-withdrawn"].includes(input.reasonCode as string)) {
    throw new Error("INSTITUTION_PLAN_REASON_INVALID");
  }
  return {
    tenantId,
    requestId: parseDraftRequestId(input.requestId),
    expectedPlanRevision: validRevision(input.expectedPlanRevision, 1, "INSTITUTION_PLAN_REVISION_INVALID"),
    action: input.action,
    reasonCode: input.reasonCode as ReviewPlanInput["reasonCode"],
  };
}
