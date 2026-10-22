import { getClassContract } from "./class-contract";
import { getLearningExperience } from "./learning-content";
import { parseDraftRequestId, parseDraftTenantId } from "./institutions/draft-input";
import type { LearningScope } from "./learning-entitlement";

export type AssessmentPublishAction = "review" | "publish" | "withdraw";
export type AssessmentWithdrawReason = "security-stop" | "rights-revoked" | "curriculum-replaced" | "operator-withdrawn";

export interface PrepareAssessmentInput extends LearningScope {
  requestId: string;
  expectedPlanRevision: number;
  offeringId: string;
  version: string;
  curriculumRevision: string;
  classSlugs: string[];
  recommendedNextSlug: string;
  reasonCode: "new-curriculum" | "curriculum-update";
}
export interface TransitionAssessmentInput extends LearningScope {
  requestId: string;
  expectedPlanRevision: number;
  action: AssessmentPublishAction;
  reasonCode: string;
  rightsRecordId?: string;
  rightsEvidenceSha256?: string;
}

export const safeAssessmentVersion = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9-]{2,95}$/.test(value);
export const safeAssessmentActor = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

export function parseAssessmentScope(tenant: unknown, program: unknown): LearningScope {
  return { tenantId: parseDraftTenantId(tenant), programId: parseDraftTenantId(program) };
}
function keys(value: Record<string, unknown>, expected: readonly string[]) {
  if (Object.keys(value).length !== expected.length ||
      Object.keys(value).some(key => !expected.includes(key))) {
    throw new Error("ASSESSMENT_PUBLICATION_UNEXPECTED_FIELD");
  }
}
function rev(value: unknown) {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > 1000000) {
    throw new Error("ASSESSMENT_PUBLICATION_REVISION_INVALID");
  }
  return value as number;
}
export function sourcesForPublishedClasses(classSlugs: string[]): string[] {
  if (classSlugs.length < 1 || classSlugs.length > 20 ||
    new Set(classSlugs).size !== classSlugs.length) {
    throw new Error("ASSESSMENT_PUBLICATION_CLASSES_INVALID");
  }
  const sources = new Set<string>();
  for (const slug of classSlugs) {
    if (!safeAssessmentVersion(slug)) throw new Error("ASSESSMENT_PUBLICATION_CLASSES_INVALID");
    const contract = getClassContract(slug);
    if (!contract || !getLearningExperience(slug) || contract.sourceIds.length < 1) {
      throw new Error("ASSESSMENT_PUBLICATION_CLASS_UNAVAILABLE");
    }
    contract.sourceIds.forEach(id => sources.add(id));
  }
  if (sources.size > 60) throw new Error("ASSESSMENT_PUBLICATION_SOURCES_EXCEEDED");
  return [...sources].sort();
}
export function parsePrepareAssessment(scope: LearningScope, raw: unknown): PrepareAssessmentInput {
  parseAssessmentScope(scope.tenantId, scope.programId);
  if (!object(raw)) throw new Error("ASSESSMENT_PUBLICATION_INPUT_INVALID");
  keys(raw, ["requestId", "expectedPlanRevision", "offeringId", "version",
    "curriculumRevision", "classSlugs", "recommendedNextSlug", "reasonCode"]);
  if (!safeAssessmentActor(raw.offeringId) || !safeAssessmentVersion(raw.version) ||
    !safeAssessmentVersion(raw.curriculumRevision) ||
    (raw.reasonCode !== "new-curriculum" && raw.reasonCode !== "curriculum-update") ||
    !Array.isArray(raw.classSlugs) || !raw.classSlugs.every(x => typeof x === "string") ||
    !safeAssessmentVersion(raw.recommendedNextSlug)) {
    throw new Error("ASSESSMENT_PUBLICATION_INPUT_INVALID");
  }
  const classSlugs = [...raw.classSlugs] as string[];
  sourcesForPublishedClasses(classSlugs);
  if (!classSlugs.includes(raw.recommendedNextSlug)) {
    throw new Error("ASSESSMENT_PUBLICATION_NEXT_ACTION_INVALID");
  }
  return {
    ...scope, requestId: parseDraftRequestId(raw.requestId),
    expectedPlanRevision: rev(raw.expectedPlanRevision),
    offeringId: raw.offeringId, version: raw.version,
    curriculumRevision: raw.curriculumRevision, classSlugs,
    recommendedNextSlug: raw.recommendedNextSlug,
    reasonCode: raw.reasonCode,
  };
}
export function parseTransitionAssessment(scope: LearningScope, raw: unknown): TransitionAssessmentInput {
  parseAssessmentScope(scope.tenantId, scope.programId);
  if (!object(raw)) throw new Error("ASSESSMENT_PUBLICATION_INPUT_INVALID");
  const action = raw.action;
  if (action !== "review" && action !== "publish" && action !== "withdraw") {
    throw new Error("ASSESSMENT_PUBLICATION_ACTION_INVALID");
  }
  keys(raw, action === "review"
    ? ["requestId", "expectedPlanRevision", "action", "reasonCode", "rightsRecordId", "rightsEvidenceSha256"]
    : ["requestId", "expectedPlanRevision", "action", "reasonCode"]);
  if (action === "review") {
    if (raw.reasonCode !== "reviewed-with-rights-evidence" ||
      !safeAssessmentActor(raw.rightsRecordId) ||
      typeof raw.rightsEvidenceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(raw.rightsEvidenceSha256)) {
      throw new Error("ASSESSMENT_PUBLICATION_RIGHTS_EVIDENCE_INVALID");
    }
  } else if (action === "publish" ? raw.reasonCode !== "publish-reviewed-curriculum"
    : !["security-stop", "rights-revoked", "curriculum-replaced", "operator-withdrawn"].includes(String(raw.reasonCode))) {
    throw new Error("ASSESSMENT_PUBLICATION_REASON_INVALID");
  }
  return {
    ...scope, requestId: parseDraftRequestId(raw.requestId),
    expectedPlanRevision: rev(raw.expectedPlanRevision),
    action, reasonCode: raw.reasonCode as string,
    ...(action === "review" ? {
      rightsRecordId: raw.rightsRecordId as string,
      rightsEvidenceSha256: raw.rightsEvidenceSha256 as string,
    } : {}),
  };
}
