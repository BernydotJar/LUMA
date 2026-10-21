import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ provider: vi.fn(), handle: vi.fn(),
  dispatch: vi.fn(), limiter: vi.fn(), reader: vi.fn(), delivery: vi.fn(), }));
vi.mock("@/lib/commerce/server", () => ({
  commerceProvider: mock.provider,
  commerceOrchestrator: { handle: mock.handle },
  commerceCorrelationId: () => "correlation-test",
  webhookInput: (_request: Request, raw: string) => ({ rawBody: raw }),
}));
vi.mock("@/lib/commerce/webhook-security", () => ({
  enforceCommerceWebhookClientRateLimit: mock.limiter,
  enforceCommerceWebhookProviderRateLimit: mock.limiter,
  readCommerceWebhookBody: mock.reader,
}));
vi.mock("@/lib/commerce/webhook-delivery", () => ({ webhookDeliveryHttp: mock.delivery }));
vi.mock("@/lib/live-classroom-revocation", () => ({ dispatchClassroomRevocation: mock.dispatch }));
import { POST } from "./route";

const enrollment = { enrollmentId: "e".repeat(64), status: "revoked", learnerId: "alice",
  tenantId: "seres", offeringId: "f".repeat(64), lastProviderEventId: "refund-event" };
const event = { provider: "hotmart", type: "commerce.payment.refunded",
  externalEventId: "refund-event" };
const req = () => new Request("https://luma.example.test/api/commerce/webhooks/hotmart", {
  method: "POST", body: "signed-body",
});
const ctx = { params: Promise.resolve({ provider: "hotmart" }) };
beforeEach(() => {
  vi.clearAllMocks();
  mock.reader.mockResolvedValue("signed-body");
  mock.provider.mockReturnValue({ handleWebhook: () => event });
  mock.handle.mockResolvedValue({ status: "processed", duplicate: false,
    outcome: "revoked", enrollment });
  mock.dispatch.mockResolvedValue({ state: "completed", evicted: 1 });
  mock.delivery.mockReturnValue({ status: 200 });
});

describe("refund webhook provider disconnect barrier", () => {
  it("does not acknowledge a refund until the provider disconnect has been attempted", async () => {
    const response = await POST(req(), ctx);
    expect(response.status).toBe(200);
    expect(mock.dispatch).toHaveBeenCalledWith(enrollment);
    expect(mock.dispatch.mock.invocationCallOrder[0]).toBeLessThan(mock.delivery.mock.invocationCallOrder[0]);
  });
  it("returns a retryable failure when the disconnect barrier fails", async () => {
    mock.dispatch.mockRejectedValue(new Error("CLASSROOM_REVOCATION_RETRYABLE"));
    const response = await POST(req(), ctx);
    expect(response.status).toBe(500);
    expect(mock.delivery).not.toHaveBeenCalled();
  });
  it("a replay of the same signed refund still drives the disconnect barrier", async () => {
    mock.handle.mockResolvedValue({ status: "processed", duplicate: true,
      outcome: "already_revoked", enrollment });
    const response = await POST(req(), ctx);
    expect(response.status).toBe(200);
    expect(mock.dispatch).toHaveBeenCalledWith(enrollment);
  });
});
