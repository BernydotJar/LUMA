import { randomUUID, createHash } from "node:crypto";
import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { afterAll, describe, expect, it } from "vitest";
import { expectedMediaPrefix, FirestoreCourseDeliveryStore, type CourseLessonManifest } from "./course-delivery";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const app = enabled ? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? "demo-luma-course-delivery" }, `course-${randomUUID()}`) : undefined;
const firestore = app ? getFirestore(app) : undefined;
const scope = { tenantId: `course-qa-${randomUUID()}`, programId: "synthetic-program" };
const other = { tenantId: scope.tenantId, programId: "other-program" };
const course = firestore ? new FirestoreCourseDeliveryStore(firestore, scope) : undefined;
const second = firestore ? new FirestoreCourseDeliveryStore(firestore, other) : undefined;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const docs = (s = scope) => firestore!.collection("learningTenants").doc(hash(s.tenantId))
  .collection("learningPrograms").doc(hash(s.programId)).collection("publishedCourseLessons");

function fixture(id: string, overrides: Partial<CourseLessonManifest> = {}): CourseLessonManifest {
  return {
    schemaVersion: 1, ...scope, lessonId: id, moduleId: "modulo-1",
    title: `Prueba de curso ${id}`, summary: "Recurso sintético, no corresponde a material del cliente.",
    locale: "es", sortOrder: 1, revision: 1, kind: "video", totalUnits: 480,
    status: "published", rightsStatus: "approved", rightsRecordId: "fixture-rights-receipt",
    reviewerUid: "qa-reviewer", reviewedAt: "2026-10-08T10:00:00Z", publishedAt: "2026-10-09T10:00:00Z",
    sourceSha256: "a".repeat(64),
    mediaObjectName: `${expectedMediaPrefix(scope, id, 1)}synthetic.mp4`,
    mediaContentType: "video/mp4", ...overrides,
  };
}
async function enroll(uid: string, s = scope) {
  await firestore!.collection("commerceEnrollments").doc(`fixture-${uid}-${hash(s.programId)}`)
    .set({ learnerId: uid, ...s, status: "active", enrollmentId: `fixture-${uid}-${s.programId}`,
      entitlementId: `fixture-${uid}-${s.programId}`, productId: "fake-product", customerId: "fake-customer",
      createdAt: "2026-10-10T10:00:00Z", updatedAt: "2026-10-10T10:00:00Z",
      lastProvider: "hotmart", lastProviderEventId: "fictional-event", lastEventAt: "2026-10-10T10:00:00Z" });
}

describe.runIf(enabled)("Course delivery Firestore emulator", () => {
  afterAll(async () => { if (app) await deleteApp(app); });

  it("only discloses approved lesson summaries scoped to tenant and program", async () => {
    const liveId = `pub-${randomUUID()}`;
    const draftId = `draft-${randomUUID()}`;
    const revokedId = `revoke-${randomUUID()}`;
    await docs().doc(liveId).set(fixture(liveId));
    await docs().doc(draftId).set(fixture(draftId, { status: "draft" }));
    await docs().doc(revokedId).set(fixture(revokedId, { rightsStatus: "revoked" }));
    // Many early unapproved documents must not hide one legitimately
    // published lesson later in the order (the previous first-page bug).
    const unpublished = firestore!.batch();
    for (let index = 0; index < 55; index += 1) {
      const id = `pending-${String(index).padStart(3, "0")}-${randomUUID()}`;
      unpublished.set(docs().doc(id), fixture(id, { status: "draft", sortOrder: 0 }));
    }
    await unpublished.commit();
    expect((await course!.getLesson(liveId))?.lessonId).toBe(liveId);
    expect(await course!.getLesson(draftId)).toBeNull();
    expect(await course!.getLesson(revokedId)).toBeNull();
    expect(await second!.getLesson(liveId)).toBeNull();
    const listed = await course!.listLessons();
    expect(listed.lessons.map((x) => x.lessonId)).toContain(liveId);
    expect(listed.lessons.map((x) => x.lessonId)).not.toContain(draftId);
    expect(listed.lessons.map((x) => x.lessonId)).not.toContain(revokedId);
    expect(JSON.stringify(listed.lessons)).not.toContain("mediaObjectName");
    await expect(course!.listLessons(99)).rejects.toThrow("COURSE_PAGE_SIZE_INVALID");
    await expect(course!.listLessons(5, "not-json")).rejects.toThrow("COURSE_CURSOR_INVALID");
  });

  it("stores resumable consumption with idempotency, monotonic position and revision invalidation", async () => {
    const uid = `jeremy-${randomUUID()}`;
    const id = `video-${randomUUID()}`;
    await docs().doc(id).set(fixture(id));
    await enroll(uid);
    const original = await course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 101, writeId: "play-1" });
    expect(original.checkpoint).toMatchObject({ furthestUnit: 101, status: "started", version: 1 });
    const replay = await course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 101, writeId: "play-1" });
    expect(replay.duplicate).toBe(true);
    const stale = await course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 18, writeId: "old-event" });
    expect(stale.checkpoint.furthestUnit).toBe(101);
    expect((await course!.getCheckpoint(uid, id))?.furthestUnit).toBe(101);
    expect((await course!.getCheckpoint("other-user", id))).toBeNull();
    const end = await course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 480, writeId: "play-end" });
    expect(end.checkpoint.status).toBe("reached_end");
    await docs().doc(id).update({ revision: 2, mediaObjectName: `${expectedMediaPrefix(scope,id,2)}new.mp4` });
    await expect(course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 481, writeId: "late-event" }))
      .rejects.toThrow("COURSE_LESSON_REVISION_CHANGED");
    const reset = await course!.saveCheckpoint(uid, id, { lessonRevision: 2, positionUnit: 24, writeId: "new-version" });
    expect(reset.checkpoint.furthestUnit).toBe(24);
    expect(reset.checkpoint.lessonRevision).toBe(2);
    // Consumption evidence is distinct from simulation grading: no Twin writes.
  });

  it("denies another learner, another program, and revoked or withdrawn access", async () => {
    const uid = `abigail-${randomUUID()}`;
    const id = `lesson-${randomUUID()}`;
    await docs().doc(id).set(fixture(id));
    await enroll(uid);
    await expect(course!.saveCheckpoint("unknown-learner", id, { lessonRevision: 1, positionUnit: 14, writeId: "attempt" }))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    await expect(second!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 14, writeId: "attempt" }))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
    const first = await course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 14, writeId: "authorized" });
    expect(first.checkpoint.furthestUnit).toBe(14);
    await docs().doc(id).update({ status: "withdrawn" });
    expect(await course!.getLesson(id)).toBeNull();
    await expect(course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 25, writeId: "withdrawn" }))
      .rejects.toThrow("COURSE_LESSON_NOT_AVAILABLE");
    await docs().doc(id).update({ status: "published" });
    await firestore!.collection("commerceEnrollments").doc(`fixture-${uid}-${hash(scope.programId)}`).update({ status: "revoked" });
    await expect(course!.saveCheckpoint(uid, id, { lessonRevision: 1, positionUnit: 30, writeId: "refunded" }))
      .rejects.toThrow("LEARNING_ACTIVE_ENTITLEMENT_REQUIRED");
  });
});
