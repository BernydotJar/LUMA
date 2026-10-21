import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ receive: vi.fn(), recordPresence: vi.fn(),
  disconnectRevoked: vi.fn(), config: vi.fn(), }));
vi.mock("livekit-server-sdk", () => ({
  WebhookReceiver: class { receive = mock.receive; },
}));
vi.mock("@/lib/live-classroom-attendance", () => ({
  recordClassroomPresence: mock.recordPresence,
}));
vi.mock("@/lib/live-classroom-revocation", () => ({
  disconnectIfClassroomAccessRevoked: mock.disconnectRevoked,
}));
vi.mock("@/lib/live-classroom-server", () => ({
  ClassroomError: class extends Error { constructor(readonly reason: string, readonly status: number) { super(reason); } },
  liveKitConfiguration: mock.config,
}));
import { POST } from "./route";

function request() {
  return new Request("https://luma.example.test/api/live/webhooks", {
    method: "POST", headers: { authorization: "test-signature" },
    body: JSON.stringify({ signed: true }),
  });
}
const signedEvent = {
  id: "EV_join", event: "participant_joined", createdAt: 1792500300,
  room: { name: "luma_" + "a".repeat(64) },
  participant: { identity: "p_" + "b".repeat(64) },
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.config.mockReturnValue({ apiKey: "test-key", apiSecret: "fake-secret" });
  mock.receive.mockResolvedValue(signedEvent);
  mock.disconnectRevoked.mockResolvedValue(false);
  mock.recordPresence.mockResolvedValue(undefined);
});

describe("signed LiveKit join revocation fence", () => {
  it("checks provider admission revocation before recording presence", async () => {
    const response = await POST(request());
    expect(response.status).toBe(204);
    expect(mock.disconnectRevoked).toHaveBeenCalledWith(signedEvent.room.name, signedEvent.participant.identity);
    expect(mock.recordPresence).toHaveBeenCalledWith(expect.objectContaining({
      type: "participant_joined", identity: signedEvent.participant.identity,
    }));
    expect(mock.disconnectRevoked.mock.invocationCallOrder[0])
      .toBeLessThan(mock.recordPresence.mock.invocationCallOrder[0]);
  });
  it("fails retryably when the media provider cannot disconnect revoked access", async () => {
    mock.disconnectRevoked.mockRejectedValue(new Error("MEDIA_KICK_FAILED"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(mock.recordPresence).not.toHaveBeenCalled();
  });
  it("never trusts unsigned or wrong-signature events", async () => {
    mock.receive.mockRejectedValue(new Error("signature invalid"));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mock.disconnectRevoked).not.toHaveBeenCalled();
    expect(mock.recordPresence).not.toHaveBeenCalled();
  });
  it("does not attempt a join fence for normal signed participant departure", async () => {
    mock.receive.mockResolvedValue({ ...signedEvent, event: "participant_left" });
    const response = await POST(request());
    expect(response.status).toBe(204);
    expect(mock.disconnectRevoked).not.toHaveBeenCalled();
    expect(mock.recordPresence).toHaveBeenCalledTimes(1);
  });
});
