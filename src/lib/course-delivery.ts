import { createHash } from "node:crypto";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { isActiveCommerceEnrollment, type CommerceEnrollmentRecord } from "./commerce/enrollment";
import { validLearningScopeId, type LearningScope } from "./learning-entitlement";

/** Institutional publication is deliberately separate from editorial module covers. */
export type LessonKind = "video" | "document";
export interface CourseLessonManifest {
  schemaVersion: 1;
  tenantId: string;
  programId: string;
  lessonId: string;
  moduleId: string;
  title: string;
  summary: string;
  locale: string;
  sortOrder: number;
  revision: number;
  kind: LessonKind;
  /** Seconds for video, pages for a document. Not an academic mastery measure. */
  totalUnits: number;
  status: "draft" | "published" | "withdrawn";
  rightsStatus: "pending" | "approved" | "revoked";
  rightsRecordId: string;
  reviewerUid: string;
  reviewedAt: string;
  publishedAt: string;
  sourceSha256: string;
  /** Never return this storage object name in a public catalog response. */
  mediaObjectName: string;
  mediaContentType: string;
}

export type CourseLessonSummary = Pick<CourseLessonManifest,
  "lessonId" | "moduleId" | "title" | "summary" | "locale" | "sortOrder" | "revision" | "kind" | "totalUnits">;

export interface LessonCheckpoint {
  learnerId: string;
  lessonId: string;
  lessonRevision: number;
  /** Furthest player location or document page reached. Self-reported consumption only. */
  furthestUnit: number;
  status: "started" | "reached_end";
  lastWriteId: string;
  version: number;
  updatedAt: string;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const safeId = (id: unknown): id is string => typeof id === "string" &&
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);

export function expectedMediaPrefix(scope: LearningScope, lessonId: string, revision: number) {
  return `courses/${hash(scope.tenantId)}/${hash(scope.programId)}/${lessonId}/v${revision}/`;
}

/** Review receipts, rights, source and media namespace must all be valid. */
export function isDeliverableLesson(value: unknown, scope: LearningScope, now = new Date()):
  value is CourseLessonManifest {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== 1 || row.tenantId !== scope.tenantId ||
    row.programId !== scope.programId || row.status !== "published" ||
    row.rightsStatus !== "approved" || !safeId(row.lessonId) ||
    !safeId(row.moduleId) || !safeId(row.reviewerUid) ||
    !safeId(row.rightsRecordId) ||
    typeof row.title !== "string" || row.title.trim().length < 3 || row.title.length > 180 ||
    typeof row.summary !== "string" || row.summary.trim().length < 5 || row.summary.length > 500 ||
    typeof row.locale !== "string" || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(row.locale) ||
    !Number.isInteger(row.sortOrder) || Number(row.sortOrder) < 0 || Number(row.sortOrder) > 999999 ||
    !Number.isInteger(row.revision) || Number(row.revision) < 1 || Number(row.revision) > 99999 ||
    !Number.isInteger(row.totalUnits) || Number(row.totalUnits) < 1 || Number(row.totalUnits) > 100000 ||
    !["video", "document"].includes(String(row.kind)) ||
    typeof row.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sourceSha256) ||
    typeof row.mediaObjectName !== "string" || typeof row.mediaContentType !== "string" ||
    !(row.kind === "video" && row.mediaContentType === "video/mp4" ||
      row.kind === "document" && row.mediaContentType === "application/pdf")) return false;

  const reviewedAt = typeof row.reviewedAt === "string" ? Date.parse(row.reviewedAt) : NaN;
  const publishedAt = typeof row.publishedAt === "string" ? Date.parse(row.publishedAt) : NaN;
  if (!Number.isFinite(reviewedAt) || !Number.isFinite(publishedAt) ||
      reviewedAt > now.getTime() || publishedAt > now.getTime() || publishedAt < reviewedAt) return false;
  const prefix = expectedMediaPrefix(scope, String(row.lessonId), Number(row.revision));
  const path = row.mediaObjectName;
  return path.startsWith(prefix) && path.length <= 900 &&
    path.slice(prefix.length).length > 0 &&
    path.split("/").every((segment) => segment !== "." && segment !== ".." && segment.length > 0) &&
    !/[?#\\\u0000-\u001f]/.test(path);
}

export function publicLesson(manifest: CourseLessonManifest): CourseLessonSummary {
  const { lessonId, moduleId, title, summary, locale, sortOrder, revision, kind, totalUnits } = manifest;
  return { lessonId, moduleId, title, summary, locale, sortOrder, revision, kind, totalUnits };
}

function decodeCursor(value?: string | null): [number, string] | undefined {
  if (!value) return undefined;
  if (!/^[a-zA-Z0-9_-]{1,350}$/.test(value)) throw new Error("COURSE_CURSOR_INVALID");
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2 ||
      !Number.isInteger(parsed[0]) || parsed[0] < 0 || parsed[0] > 999999 || !safeId(parsed[1])) {
      throw new Error("COURSE_CURSOR_INVALID");
    }
    return [parsed[0], parsed[1]];
  } catch { throw new Error("COURSE_CURSOR_INVALID"); }
}

export class FirestoreCourseDeliveryStore {
  constructor(private readonly firestore: Firestore, private readonly scope: LearningScope) {
    if (!validLearningScopeId(scope.tenantId) || !validLearningScopeId(scope.programId)) {
      throw new Error("COURSE_SCOPE_INVALID");
    }
  }

  private base() {
    return this.firestore.collection("learningTenants").doc(hash(this.scope.tenantId))
      .collection("learningPrograms").doc(hash(this.scope.programId));
  }

  /** This collection contains *published* receipts only. Editors use a distinct draft workflow. */
  private lessons() { return this.base().collection("publishedCourseLessons"); }
  private lessonRef(id: string) {
    if (!safeId(id)) throw new Error("COURSE_LESSON_ID_INVALID");
    return this.lessons().doc(id);
  }
  private checkpointRef(uid: string, lessonId: string) {
    // Firebase UIDs are opaque, not necessarily human-safe Firestore path parts.
    if (typeof uid !== "string" || !uid.trim() || uid.length > 256) {
      throw new Error("COURSE_LEARNER_ID_INVALID");
    }
    return this.base().collection("learnerLessonCheckpoints").doc(hash(uid))
      .collection("lessons").doc(lessonId);
  }

  async getLesson(lessonId: string): Promise<CourseLessonManifest | null> {
    const snapshot = await this.lessonRef(lessonId).get();
    const value = snapshot.data();
    return snapshot.exists && isDeliverableLesson(value, this.scope) && value!.lessonId === lessonId
      ? value as CourseLessonManifest : null;
  }

  async listLessons(pageSize = 40, cursor?: string | null) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 80) {
      throw new Error("COURSE_PAGE_SIZE_INVALID");
    }
    // Invalid or withdrawn records cannot starve later approved material.
    // Cap the number of Firestore scans per HTTP page.
    const batchSize = 50;
    const maxBatches = 5;
    let after = decodeCursor(cursor);
    let hasMore = false;
    const lessons: CourseLessonSummary[] = [];
    for (let batch = 0; batch < maxBatches && lessons.length < pageSize; batch += 1) {
      let query = this.lessons().orderBy("sortOrder", "asc")
        .orderBy(FieldPath.documentId(), "asc").limit(batchSize + 1);
      if (after) query = query.startAfter(after[0], after[1]);
      const snapshot = await query.get();
      const docs = snapshot.docs.slice(0, batchSize);
      if (!docs.length) { hasMore = false; break; }
      let processed = 0;
      for (const doc of docs) {
        processed += 1;
        const data = doc.data();
        if (doc.id === data.lessonId && isDeliverableLesson(data, this.scope)) {
          lessons.push(publicLesson(data));
        }
        if (lessons.length === pageSize) break;
      }
      const last = docs[processed - 1];
      const sortOrder = last.data().sortOrder as unknown;
      if (!Number.isInteger(sortOrder) || (sortOrder as number) < 0 ||
          (sortOrder as number) > 999999) {
        throw new Error("COURSE_CATALOG_CORRUPT");
      }
      after = [sortOrder as number, last.id];
      hasMore = snapshot.docs.length > processed;
      if (!hasMore) break;
    }
    return {
      lessons,
      nextCursor: hasMore && after
        ? Buffer.from(JSON.stringify(after)).toString("base64url")
        : null,
    };
  }

  async getCheckpoint(uid: string, lessonId: string): Promise<LessonCheckpoint | null> {
    const snapshot = await this.checkpointRef(uid, lessonId).get();
    return snapshot.exists ? snapshot.data() as LessonCheckpoint : null;
  }

  async saveCheckpoint(uid: string, lessonId: string, input: {
    lessonRevision: number; positionUnit: number; writeId: string;
  }): Promise<{ checkpoint: LessonCheckpoint; duplicate: boolean }> {
    if (!safeId(input.writeId) || !Number.isInteger(input.lessonRevision) ||
      !Number.isFinite(input.positionUnit) || !Number.isInteger(input.positionUnit) ||
      input.positionUnit < 0) throw new Error("COURSE_CHECKPOINT_INVALID");
    const lessonRef = this.lessonRef(lessonId);
    const checkpointRef = this.checkpointRef(uid, lessonId);
    const enrollmentQuery = this.firestore.collection("commerceEnrollments")
      .where("learnerId", "==", uid).limit(501);

    return this.firestore.runTransaction(async (transaction) => {
      // Read the *current* entitlement and publication receipt within the
      // transaction to avoid committing a checkpoint after a concurrent refund.
      const [enrollments, lessonDoc, checkpointDoc] = await Promise.all([
        transaction.get(enrollmentQuery), transaction.get(lessonRef), transaction.get(checkpointRef),
      ]);
      if (enrollments.size > 500) throw new Error("COURSE_ENTITLEMENT_SCAN_LIMIT");
      if (!enrollments.docs.some((doc) => {
        const record = doc.data() as CommerceEnrollmentRecord;
        return record.tenantId === this.scope.tenantId && record.programId === this.scope.programId &&
          record.learnerId === uid && isActiveCommerceEnrollment(record);
      })) throw new Error("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
      const lesson = lessonDoc.data();
      if (!lessonDoc.exists || !isDeliverableLesson(lesson, this.scope) ||
        lesson?.lessonId !== lessonId) throw new Error("COURSE_LESSON_NOT_AVAILABLE");
      if (lesson.revision !== input.lessonRevision) throw new Error("COURSE_LESSON_REVISION_CHANGED");
      if (input.positionUnit > lesson.totalUnits) throw new Error("COURSE_CHECKPOINT_INVALID");
      const current = checkpointDoc.exists ? checkpointDoc.data() as LessonCheckpoint : undefined;
      if (current?.lessonRevision === lesson.revision && current.lastWriteId === input.writeId) {
        return { checkpoint: current, duplicate: true };
      }
      const last = current?.lessonRevision === lesson.revision ? current.furthestUnit : 0;
      const furthestUnit = Math.max(last, input.positionUnit);
      const checkpoint: LessonCheckpoint = {
        learnerId: uid, lessonId, lessonRevision: lesson.revision, furthestUnit,
        status: furthestUnit >= lesson.totalUnits ? "reached_end" : "started",
        lastWriteId: input.writeId,
        version: (current?.version ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      transaction.set(checkpointRef, checkpoint);
      return { checkpoint, duplicate: false };
    });
  }
}
