import { describe, expect, it, vi } from "vitest";
import { enqueueClassroomRevocation, mayRestoreRevokedLearnerAccess, revocationJobId } from "./live-classroom-revocation-queue";

const input = {
  enrollmentId: "e".repeat(64), tenantId: "tenant-a", offeringId: "o".repeat(64),
  learnerId: "firebase-learner", sourceEventId: "EV-refund-1",
  createdAt: "2026-10-20T08:00:00.000Z",
};

describe("transactional live-classroom revocation queue", () => {
  it("has deterministic event scoped IDs and no plaintext claimant ID in keys", () => {
    const id = revocationJobId(input);
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(id).toBe(revocationJobId({ ...input }));
    expect(id).not.toContain(input.learnerId);
    expect(id).not.toBe(revocationJobId({ ...input, sourceEventId: "EV-refund-2" }));
  });
  it("creates durable work only inside an existing enrollment transaction", () => {
    const create = vi.fn();
    const doc = vi.fn((id) => ({ id }));
    const collection = vi.fn(() => ({ doc }));
    enqueueClassroomRevocation({ collection } as never, { create } as never, input);
    expect(collection).toHaveBeenCalledWith("liveClassroomRevocations");
    expect(doc).toHaveBeenCalledWith(revocationJobId(input));
    expect(create).toHaveBeenCalledWith({ id: revocationJobId(input) },
      expect.objectContaining({ state: "pending", learnerId: input.learnerId, attempts: 0 }));
  });
  it("restores an access-revocation ban only after a newer verified enrollment", () => {
    const ref = { bannedAt: "2026-10-20T13:00:00Z", banReason: "enrollment_revoked" };
    expect(mayRestoreRevokedLearnerAccess(ref, ["2026-10-20T13:00:01Z"])).toBe(true);
    expect(mayRestoreRevokedLearnerAccess(ref, ["2026-10-20T12:59:59Z"])).toBe(false);
    expect(mayRestoreRevokedLearnerAccess({ ...ref, banReason: "instructor_ban" }, ["2026-10-21T00:00:00Z"])).toBe(false);
    expect(mayRestoreRevokedLearnerAccess({ banReason: "enrollment_revoked" }, ["2026-10-21T00:00:00Z"])).toBe(false);
  });
  it("refuses missing identity fields", () => {
    expect(() => enqueueClassroomRevocation({} as never, {} as never,
      { ...input, learnerId: "" })).toThrow("CLASSROOM_REVOCATION_INVALID");
  });
});
