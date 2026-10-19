import { timingSafeEqual, createHash } from "node:crypto";
import { parseDraftTenantId } from "./draft-input";

export type ReviewAction = "screen" | "reject" | "invite" | "reissue" | "revoke_invitation";
export interface ScreenInput {
  action: "screen";
  expectedStatus: "received";
  tenantId: string;
  initialProgramId: string;
  reason: string;
}
export interface RejectInput {
  action: "reject";
  expectedStatus: "received" | "in_review" | "invitation_pending" | "invitation_accepted";
  reason: string;
}
export interface InviteInput {
  action: "invite";
  expectedStatus: "in_review";
  reason: string;
}
export interface RevokeInput {
  action: "revoke_invitation";
  expectedStatus: "invitation_pending" | "invitation_accepted";
  reason: string;
}
export interface ReissueInput {
  action: "reissue";
  expectedStatus: "invitation_pending";
  reason: string;
}
export type OperatorDecision = ScreenInput | RejectInput | InviteInput | ReissueInput | RevokeInput;

export const applicationRetentionDays = {
  received: 90,
  in_review: 90,
  invitation_pending: 90,
  invitation_accepted: 90,
  rejected: 30,
  activated: 365,
} as const;
export function retentionDate(status: keyof typeof applicationRetentionDays, now: string): string {
  return new Date(Date.parse(now) + applicationRetentionDays[status] * 86400_000).toISOString();
}

export function parseOperatorDecision(raw: unknown): OperatorDecision {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      Object.getPrototypeOf(raw) !== Object.prototype) throw new Error("REVIEW_INPUT_INVALID");
  const o = raw as Record<string, unknown>;
  if (!["screen", "reject", "invite", "reissue", "revoke_invitation"].includes(String(o.action))) {
    throw new Error("REVIEW_INPUT_INVALID");
  }
  const action = o.action as ReviewAction;
  const keys = action === "screen" ? ["action", "expectedStatus", "tenantId", "initialProgramId", "reason"] :
    ["action", "expectedStatus", "reason"];
  if (Object.keys(o).length !== keys.length || Object.keys(o).some(k => !keys.includes(k)) ||
      typeof o.reason !== "string" || o.reason !== o.reason.trim() ||
      o.reason.length < 20 || o.reason.length > 500 || /[\u0000-\u001f\u007f<>]/.test(o.reason)) {
    throw new Error("REVIEW_INPUT_INVALID");
  }
  if (action === "screen") {
    if (o.expectedStatus !== "received") throw new Error("REVIEW_STATE_INVALID");
    const tenantId = parseDraftTenantId(o.tenantId);
    const initialProgramId = parseDraftTenantId(o.initialProgramId);
    if (tenantId === initialProgramId) throw new Error("REVIEW_INPUT_INVALID");
    return { action, expectedStatus: "received", tenantId, initialProgramId, reason: o.reason };
  }
  if (action === "invite") {
    if (o.expectedStatus !== "in_review") throw new Error("REVIEW_STATE_INVALID");
    return { action, expectedStatus: "in_review", reason: o.reason };
  }
  if (action === "reissue") {
    if (o.expectedStatus !== "invitation_pending") throw new Error("REVIEW_STATE_INVALID");
    return { action, expectedStatus: "invitation_pending", reason: o.reason };
  }
  if (action === "reject" &&
      ["received", "in_review", "invitation_pending", "invitation_accepted"].includes(String(o.expectedStatus))) {
    return { action, expectedStatus: o.expectedStatus as RejectInput["expectedStatus"], reason: o.reason };
  }
  if (action === "revoke_invitation" &&
      ["invitation_pending", "invitation_accepted"].includes(String(o.expectedStatus))) {
    return { action, expectedStatus: o.expectedStatus as RevokeInput["expectedStatus"], reason: o.reason };
  }
  throw new Error("REVIEW_STATE_INVALID");
}

export function secureInvitationDigest(token: string): string {
  return createHash("sha256").update("luma-academy-invitation-v1:" + token).digest("hex");
}
export function compareInvitationDigest(token: unknown, digest: unknown): boolean {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token) ||
      typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) return false;
  const a = Buffer.from(secureInvitationDigest(token), "hex");
  return timingSafeEqual(a, Buffer.from(digest, "hex"));
}
