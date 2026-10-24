import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  authorize: vi.fn(),
  maintenance: vi.fn(),
}));
vi.mock("@/lib/live-classroom-maintenance-auth", () => ({
  verifyClassroomMaintenanceCaller: mock.authorize,
}));
vi.mock("@/lib/live-classroom-maintenance-server", () => ({
  runClassroomMaintenance: mock.maintenance,
}));
import { POST } from "./route";

const request = () => new Request("https://luma.example.test/api/internal/live-classroom/reconcile", {
  method: "POST",
});

describe("maintenance API closed by default", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mock.authorize.mockResolvedValue({ ok: true, principal: "test@project.iam.gserviceaccount.com" });
    mock.maintenance.mockResolvedValue({
      state: "completed", checkedAt: "2026-10-20T00:00:00.000Z",
      expiredEnrollments: 0, queuedDisconnects: 0, processedDisconnects: 0,
      removedParticipants: 0, retryableFailures: 0, limitReached: false,
    });
  });
  it("never enters the dispatcher when the caller is not authorized", async () => {
    mock.authorize.mockResolvedValue({ ok: false, reason: "maintenance_auth_required", status: 401 });
    expect((await POST(request())).status).toBe(401);
    expect(mock.maintenance).not.toHaveBeenCalled();
  });
  it("never runs while product feature is disabled", async () => {
    vi.stubEnv("LUMA_LIVE_CLASSROOM_ENABLED", "false");
    expect((await POST(request())).status).toBe(503);
    expect(mock.maintenance).not.toHaveBeenCalled();
  });
  it("reports true retryable failure to Scheduler rather than ACKing success", async () => {
    vi.stubEnv("LUMA_LIVE_CLASSROOM_ENABLED", "true");
    mock.maintenance.mockResolvedValueOnce({
      state: "completed", retryableFailures: 1, limitReached: false,
    });
    expect((await POST(request())).status).toBe(503);
    expect((await POST(request())).status).toBe(200);
  });
});
