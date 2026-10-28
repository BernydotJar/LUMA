import { createHash } from "node:crypto";
import { validLearningScopeId, type LearningScope } from "@/lib/learning-entitlement";
import type { LearnerState, RankedLearningAction } from "@/types/learning";

/**
 * Teacher-approved instructional method, NOT a replica of the teacher's
 * identity, emotions, personality, or voice. Never use this as a role grant.
 */
export interface TeachingTwinMethod {
  title: string;
  objective: string;
  pedagogicalPrinciples: string[];
  strategies: {
    explain: ApprovedStrategy;
    practice: ApprovedStrategy;
    remediate: ApprovedStrategy;
  };
  escalation: {
    consecutiveFailures: number;
    confidenceBelow: number;
  };
  assessment: {
    rubricId: string;
    rubricVersion: string;
    criterionIds: string[];
  };
}

export interface ApprovedStrategy {
  instruction: string;
  approvedSourceIds: string[];
}

export interface TeachingTwinRevision {
  schemaVersion: 1;
  revision: number;
  tenantId: string;
  programId: string;
  teacherUid: string;
  method: TeachingTwinMethod;
  methodSha256: string;
  status: "DRAFT" | "APPROVED";
  createdAt: string;
  approvedAt?: string;
  approvedByUid?: string;
}

export type PedagogicalMove = "DIAGNOSTIC" | "PRACTICE" | "REMEDIATE" | "ESCALATE";

export interface TwinLearningDecision {
  kind: "TWIN_RECOMMENDATION";
  proposedOnly: true;
  learningMove: PedagogicalMove;
  teacherTwinRevision: number;
  learnerProjectionVersion: number;
  teacherMethodSha256: string;
  learnerId: string;
  conceptId: string;
  reason: string;
  recommendedActionId: string;
  approvedSourceIds: string[];
  sourceVerification: "TEACHER_DECLARED_NOT_RETRIEVAL_VERIFIED";
  requiresHumanReview: boolean;
  masteryMutationAuthorized: false;
}

/** Only bounded, plain authored content enters the curriculum configuration. */
export function validTeachingTwinMethod(value: unknown): value is TeachingTwinMethod {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const short = (x: unknown, max = 240): x is string =>
    typeof x === "string" && x.trim().length > 0 && x.length <= max;
  const ids = (x: unknown, max = 12): x is string[] =>
    Array.isArray(x) && x.length > 0 && x.length <= max &&
    x.every((s) => short(s, 120) && /^[A-Za-z0-9._:-]+$/.test(s)) &&
    new Set(x).size === x.length;
  if (!short(v.title, 120) || !short(v.objective, 500) ||
    !Array.isArray(v.pedagogicalPrinciples) ||
    v.pedagogicalPrinciples.length < 1 || v.pedagogicalPrinciples.length > 8 ||
    !v.pedagogicalPrinciples.every((s: unknown) => short(s, 280))) return false;
  if (!v.strategies || typeof v.strategies !== "object" ||
    Array.isArray(v.strategies)) return false;
  const strategies = v.strategies as Record<string, unknown>;
  for (const key of ["explain", "practice", "remediate"]) {
    const strategy = strategies[key];
    if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) return false;
    const s = strategy as Record<string, unknown>;
    if (!short(s.instruction, 1000) || !ids(s.approvedSourceIds)) return false;
  }
  if (!v.escalation || typeof v.escalation !== "object") return false;
  const esc = v.escalation as Record<string, unknown>;
  if (typeof esc.consecutiveFailures !== "number" ||
      !Number.isInteger(esc.consecutiveFailures) ||
      Number(esc.consecutiveFailures) < 1 || Number(esc.consecutiveFailures) > 5 ||
      typeof esc.confidenceBelow !== "number" ||
      !Number.isFinite(esc.confidenceBelow) ||
      esc.confidenceBelow <= 0 || esc.confidenceBelow >= 1) return false;
  if (!v.assessment || typeof v.assessment !== "object") return false;
  const assessment = v.assessment as Record<string, unknown>;
  return short(assessment.rubricId, 120) &&
    short(assessment.rubricVersion, 80) &&
    ids(assessment.criterionIds, 20);
}

export function methodDigest(method: TeachingTwinMethod): string {
  return createHash("sha256").update(JSON.stringify(method)).digest("hex");
}

export function assertTwinPilotScope(
  scope: LearningScope | undefined,
  env: Record<string, string | undefined> = process.env,
): asserts scope is LearningScope {
  if (env.LUMA_TWIN_PILOT_ENABLED !== "true") throw new Error("TWIN_PILOT_DISABLED");
  if (!scope ||
      !validLearningScopeId(scope.tenantId) ||
      !validLearningScopeId(scope.programId) ||
      !validLearningScopeId(env.LUMA_TWIN_PILOT_TENANT_ID ?? "") ||
      !validLearningScopeId(env.LUMA_TWIN_PILOT_PROGRAM_ID ?? "") ||
      scope.tenantId !== env.LUMA_TWIN_PILOT_TENANT_ID ||
      scope.programId !== env.LUMA_TWIN_PILOT_PROGRAM_ID) {
    throw new Error("TWIN_PILOT_SCOPE_FORBIDDEN");
  }
}

/** One explicitly enrolled instructor, with independent verified coach claims. */
export function assertPilotTeacher(
  uid: string,
  authorizedTenantIds: string[],
  scope: LearningScope,
  env: Record<string, string | undefined> = process.env,
): void {
  assertTwinPilotScope(scope, env);
  if (!uid || uid !== env.LUMA_TWIN_PILOT_TEACHER_UID ||
      !authorizedTenantIds.includes(scope.tenantId)) {
    throw new Error("TWIN_PILOT_TEACHER_FORBIDDEN");
  }
}

export function decideTwinLearningMove(input: {
  learner: LearnerState;
  learnerProjectionVersion: number;
  action: RankedLearningAction;
  teacher: TeachingTwinRevision;
}): TwinLearningDecision {
  const { learner, learnerProjectionVersion, action, teacher } = input;
  if (teacher.status !== "APPROVED" || teacher.revision < 1 ||
      !validTeachingTwinMethod(teacher.method) ||
      teacher.methodSha256 !== methodDigest(teacher.method) ||
      learner.learnerId.trim().length === 0 ||
      learnerProjectionVersion < 1) throw new Error("TWIN_DECISION_UNTRUSTED_INPUT");
  const concept = learner.concepts.find((c) => c.conceptId === action.conceptId);
  if (!concept) throw new Error("TWIN_DECISION_CONCEPT_NOT_FOUND");
  const failures = concept.attempts > 0 ? concept.consecutiveFailures : 0;
  const humanReview =
    failures >= teacher.method.escalation.consecutiveFailures ||
    (concept.attempts > 0 &&
      concept.confidence < teacher.method.escalation.confidenceBelow);
  const move: PedagogicalMove = humanReview ? "ESCALATE" :
    concept.attempts === 0 ? "DIAGNOSTIC" :
    failures > 0 ? "REMEDIATE" : "PRACTICE";
  const key = move === "REMEDIATE" || move === "ESCALATE" ? "remediate" :
    move === "DIAGNOSTIC" ? "explain" : "practice";
  return {
    kind: "TWIN_RECOMMENDATION",
    proposedOnly: true,
    learningMove: move,
    teacherTwinRevision: teacher.revision,
    learnerProjectionVersion,
    teacherMethodSha256: teacher.methodSha256,
    learnerId: learner.learnerId,
    conceptId: action.conceptId,
    reason: humanReview ?
      "La evidencia justifica revisión del docente; no se decide dominio ni certificación." :
      action.reason,
    recommendedActionId: action.id,
    approvedSourceIds: [...teacher.method.strategies[key].approvedSourceIds],
    sourceVerification: "TEACHER_DECLARED_NOT_RETRIEVAL_VERIFIED",
    requiresHumanReview: humanReview,
    masteryMutationAuthorized: false,
  };
}
