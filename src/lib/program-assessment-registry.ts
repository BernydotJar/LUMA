import { createHash } from "node:crypto";
import type { DocumentReference, DocumentSnapshot, Firestore, Transaction } from "firebase-admin/firestore";
import { getClassContract } from "./class-contract";
import { getLearningExperience } from "./learning-content";
import { validLearningScopeId, type LearningScope } from "./learning-entitlement";

/**
 * Institution-controlled catalogue. No learner/client route may publish or select
 * versions. Admin provisioning is separate from authenticated learner reads.
 */
export interface PublishedProgramAssessment {
  tenantId: string;
  programId: string;
  offeringId: string;
  version: string;
  curriculumRevision: string;
  classSlugs: string[];
  sourceIds: string[];
  recommendedNextSlug: string;
  approvedByUid: string;
  submittedByUid: string;
  approvedAt: string;
  publishedAt: string;
}

type Pointer = {
  schemaVersion: number;
  tenantId: string;
  programId: string;
  status: string;
  activeVersion: string;
  offeringId: string;
};

type Revision = PublishedProgramAssessment & {
  schemaVersion: number;
  status: string;
};

type Offering = { offeringId: string; tenantId: string; programId: string; status: string };

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const versionId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-z][a-z0-9-]{2,95}$/.test(v);
const stableId = (v: unknown): v is string =>
  typeof v === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{1,127}$/.test(v);
const validDate = (value: unknown) => typeof value === "string" &&
  Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now();
const distinct = (values: string[]) => new Set(values).size === values.length;

/** This is an authoring template only. Never an implicit fallback for a paid program. */
export const SE_PRACTITIONER_CLASS_SLUGS = [
  "calibracion-observar-antes-de-interpretar",
  "congruencia-tres-canales",
  "rapport-sintonia-con-respeto",
  "pas-detectar-y-reformular",
  "creencias-evidencia-e-interpretacion",
] as const;

export function assessmentCatalogPaths(scope: LearningScope) {
  if (!validLearningScopeId(scope.tenantId) || !validLearningScopeId(scope.programId)) {
    throw new Error("ASSESSMENT_SCOPE_INVALID");
  }
  const key = hash([scope.tenantId, scope.programId]);
  return {
    pointer: `learningAssessmentPrograms/${key}`,
    version: (id: string) => {
      if (!versionId(id)) throw new Error("ASSESSMENT_VERSION_INVALID");
      return `learningAssessmentPrograms/${key}/versions/${id}`;
    },
  };
}

/**
 * Strongly verify the entire published snapshot. This rejects a deliberately
 * plausible-looking registry referencing other tenant media or a draft offering.
 */
export function validatePublishedProgramAssessment(
  scope: LearningScope,
  pointer: unknown,
  revision: unknown,
  offering: unknown,
): PublishedProgramAssessment | null {
  if (!pointer || !revision || !offering ||
    typeof pointer !== "object" || typeof revision !== "object" || typeof offering !== "object") return null;
  const p = pointer as Pointer;
  const r = revision as Revision;
  const o = offering as Offering;
  if (p.schemaVersion !== 1 || r.schemaVersion !== 1 || p.status !== "published" || r.status !== "approved" ||
    p.tenantId !== scope.tenantId || r.tenantId !== scope.tenantId ||
    p.programId !== scope.programId || r.programId !== scope.programId ||
    !versionId(p.activeVersion) || r.version !== p.activeVersion ||
    !stableId(p.offeringId) || r.offeringId !== p.offeringId ||
    o.offeringId !== p.offeringId || o.tenantId !== scope.tenantId ||
    o.programId !== scope.programId || o.status !== "active" ||
    !versionId(r.curriculumRevision) || !stableId(r.approvedByUid) ||
    !stableId(r.submittedByUid) || r.approvedByUid === r.submittedByUid ||
    !validDate(r.approvedAt) || !validDate(r.publishedAt) ||
    Date.parse(r.publishedAt) < Date.parse(r.approvedAt) ||
    !Array.isArray(r.classSlugs) || r.classSlugs.length < 1 || r.classSlugs.length > 20 ||
    !r.classSlugs.every(stableId) || !distinct(r.classSlugs) ||
    !stableId(r.recommendedNextSlug) ||
    !r.classSlugs.includes(r.recommendedNextSlug) ||
    !Array.isArray(r.sourceIds) || r.sourceIds.length < 1 || r.sourceIds.length > 60 ||
    !r.sourceIds.every((id) => typeof id === "string" && id.length > 2 && id.length <= 256) ||
    !distinct(r.sourceIds)) return null;

  const expectedSources = new Set<string>();
  for (const slug of r.classSlugs) {
    const contract = getClassContract(slug);
    const experience = getLearningExperience(slug);
    if (!contract || !experience || contract.sourceIds.length === 0) return null;
    for (const sourceId of contract.sourceIds) expectedSources.add(sourceId);
  }
  // An approved program may cite precisely these sources, no extra unapproved corpus.
  if (expectedSources.size !== r.sourceIds.length ||
    !r.sourceIds.every((sourceId) => expectedSources.has(sourceId))) return null;

  return {
    tenantId: r.tenantId,
    programId: r.programId,
    offeringId: r.offeringId,
    version: r.version,
    curriculumRevision: r.curriculumRevision,
    classSlugs: [...r.classSlugs],
    sourceIds: [...r.sourceIds],
    recommendedNextSlug: r.recommendedNextSlug,
    approvedByUid: r.approvedByUid,
    submittedByUid: r.submittedByUid,
    approvedAt: r.approvedAt,
    publishedAt: r.publishedAt,
  };
}

type ReadSnapshot = (reference: DocumentReference) => Promise<DocumentSnapshot>;

/** Can run inside a learner-event Firestore transaction: registry rollback
 * immediately blocks a concurrent attempt to record an assessment. */
export async function loadPublishedProgramAssessment(
  firestore: Firestore,
  scope: LearningScope,
  read: ReadSnapshot = (ref) => ref.get(),
): Promise<PublishedProgramAssessment | null> {
  const paths = assessmentCatalogPaths(scope);
  const pointerSnap = await read(firestore.doc(paths.pointer));
  if (!pointerSnap.exists) return null;
  const pointer = pointerSnap.data() as Partial<Pointer>;
  if (!versionId(pointer.activeVersion) || !stableId(pointer.offeringId)) return null;
  const [revisionSnap, offeringSnap] = await Promise.all([
    read(firestore.doc(paths.version(pointer.activeVersion))),
    read(firestore.collection("programOfferings").doc(pointer.offeringId)),
  ]);
  return validatePublishedProgramAssessment(scope, pointer, revisionSnap.data(), offeringSnap.data());
}

export async function requireCurrentProgramAssessment(
  transaction: Transaction,
  firestore: Firestore,
  scope: LearningScope,
  summary: {
    version: string;
    tenantId?: string;
    programId?: string;
    offeringId?: string;
    curriculumRevision?: string;
  } | undefined,
): Promise<void> {
  const approved = await loadPublishedProgramAssessment(firestore, scope, (ref) => transaction.get(ref));
  if (!approved || !summary ||
    approved.tenantId !== summary.tenantId || approved.programId !== summary.programId ||
    approved.offeringId !== summary.offeringId || approved.version !== summary.version ||
    approved.curriculumRevision !== summary.curriculumRevision) {
    throw new Error("ASSESSMENT_REGISTRY_CHANGED");
  }
}
