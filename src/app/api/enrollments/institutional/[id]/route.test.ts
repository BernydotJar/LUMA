import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), authorize: vi.fn(), revoke: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/learning-server", () => ({ requireLearningAdmin: mocks.admin }));
vi.mock("@/lib/commerce/institutional-grant-server", () => ({
  institutionalGrants: { revoke: mocks.revoke },
}));
vi.mock("@/lib/commerce/institutional-grants", () => ({
  authorizeInstitutionalAdmin: mocks.authorize,
}));
vi.mock("@/lib/live-classroom-revocation", () => ({
  dispatchClassroomRevocation: mocks.dispatch,
}));
import { POST } from "./route";
const sample = { enrollmentId: "a".repeat(64), status: "revoked", tenantId: "tenant-a",
  learnerId: "learner-a", offeringId: "b".repeat(64), lastProviderEventId: "REV_1" };
function request() {
  return new Request("https://luma.example.test/api/enrollments/institutional/a", {
    method: "POST", body: JSON.stringify({ tenantId: "tenant-a", reason: "contract ended" }),
    headers: { "content-type": "application/json" },
  });
}
const context = { params: Promise.resolve({ id: sample.enrollmentId }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ uid: "admin-a" });
  mocks.revoke.mockResolvedValue({ record: sample, duplicate: false });
  mocks.dispatch.mockResolvedValue({ state: "completed", evicted: 1 });
});
describe("institutional revocation request vs media provider consistency", () => {
  it("does not return success until the media disconnect is attempted", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith({ uid: "admin-a" }, "tenant-a");
    expect(mocks.revoke).toHaveBeenCalledWith("tenant-a", sample.enrollmentId, "admin-a", "contract ended");
    expect(mocks.dispatch).toHaveBeenCalledWith(sample);
  });
  it("returns a retryable failure even when the institutional record was already revoked", async () => {
    mocks.revoke.mockResolvedValue({ record: sample, duplicate: true });
    mocks.dispatch.mockRejectedValue(new Error("CLASSROOM_REVOCATION_RETRYABLE"));
    const response = await POST(request(), context);
    expect(response.status).toBe(500);
    expect(mocks.dispatch).toHaveBeenCalledWith(sample);
  });
  it("denies unauthorized calls without revoking grants or touching media", async () => {
    mocks.authorize.mockImplementation(() => { throw new Error("INSTITUTIONAL_TENANT_FORBIDDEN"); });
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
