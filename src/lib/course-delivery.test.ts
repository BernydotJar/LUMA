import { describe, expect, it } from "vitest";
import { expectedMediaPrefix, isDeliverableLesson, publicLesson, type CourseLessonManifest } from "./course-delivery";

const scope = { tenantId: "synthetic-school", programId: "sample-program" };
const synthetic: CourseLessonManifest = {
  schemaVersion: 1, ...scope, lessonId: "sample-lesson", moduleId: "module-1",
  title: "Lección sintética de prueba", summary: "Material generado únicamente para verificar el contrato de acceso.",
  locale: "es", sortOrder: 0, revision: 1, kind: "video", totalUnits: 480,
  status: "published", rightsStatus: "approved", rightsRecordId: "qa-license-receipt",
  reviewerUid: "qa-editor", reviewedAt: "2026-10-09T10:00:00Z", publishedAt: "2026-10-09T11:00:00Z",
  sourceSha256: "a".repeat(64),
  mediaObjectName: `${expectedMediaPrefix(scope, "sample-lesson", 1)}qa-video.mp4`,
  mediaContentType: "video/mp4",
};

describe("Course publication gates", () => {
  it("accepts only a signed-off, rights-approved, properly scoped publication receipt", () => {
    expect(isDeliverableLesson(synthetic, scope)).toBe(true);
    expect(isDeliverableLesson({ ...synthetic, rightsStatus: "pending" }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, status: "draft" }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, status: "withdrawn" }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, publishedAt: "2090-01-01T00:00:00Z" }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, sourceSha256: "unknown" }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, reviewerUid: "" }, scope)).toBe(false);
    expect(isDeliverableLesson(synthetic, { ...scope, tenantId: "other-school" })).toBe(false);
    expect(isDeliverableLesson(synthetic, { ...scope, programId: "other-course" })).toBe(false);
  });

  it("rejects wrong-tenant media, traversal and nonapproved content types", () => {
    expect(isDeliverableLesson({ ...synthetic, mediaObjectName: "file.pdf" }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, mediaObjectName: `${expectedMediaPrefix(scope, "sample-lesson", 1)}../qa.mp4` }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, mediaContentType: "text/html" }, scope)).toBe(false);
    expect(isDeliverableLesson({ ...synthetic, lessonId: "../other" }, scope)).toBe(false);
  });

  it("returns a privacy-safe summary without signed or raw media paths", () => {
    const summary = publicLesson(synthetic);
    expect(summary).toMatchObject({ lessonId: "sample-lesson", kind: "video", totalUnits: 480 });
    expect(JSON.stringify(summary)).not.toContain("qa-video.mp4");
    expect(Object.hasOwn(summary, "mediaObjectName")).toBe(false);
    expect(Object.hasOwn(summary, "rightsRecordId")).toBe(false);
    expect(Object.hasOwn(summary, "reviewerUid")).toBe(false);
  });
});
