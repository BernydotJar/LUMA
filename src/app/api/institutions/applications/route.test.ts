import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({ firebaseAdminFirestore: {} }));
vi.mock("@/lib/learning-server", () => ({
  requireLearningUser: vi.fn(async () => { throw new Error("AUTH_REQUIRED"); }),
}));
const { GET, POST } = await import("./route");
const previousFlag = process.env.LUMA_INSTITUTION_REQUESTS_ENABLED;

afterEach(() => {
  if (previousFlag === undefined) delete process.env.LUMA_INSTITUTION_REQUESTS_ENABLED;
  else process.env.LUMA_INSTITUTION_REQUESTS_ENABLED = previousFlag;
});

describe("first academy intake is disabled unless deliberately enabled", () => {
  it("GET and POST reject without an explicit enabled flag", async () => {
    delete process.env.LUMA_INSTITUTION_REQUESTS_ENABLED;
    for (const reply of [await GET(new Request("http://localhost/api/institutions/applications")),
      await POST(new Request("http://localhost/api/institutions/applications", { method: "POST" }))]) {
      expect(reply.status).toBe(503);
      expect(await reply.json()).toEqual({ error: "feature_unavailable" });
    }
  });
  it("does not accept case-insensitive or whitespace-padded feature activation", async () => {
    for (const flag of ["True", "TRUE", "1", "true ", "false"]) {
      process.env.LUMA_INSTITUTION_REQUESTS_ENABLED = flag;
      const reply = await GET(new Request("http://localhost/api/institutions/applications"));
      expect(reply.status).toBe(503);
    }
  });
  it("enabled endpoint requires a valid bearer identity", async () => {
    process.env.LUMA_INSTITUTION_REQUESTS_ENABLED = "true";
    const reply = await GET(new Request("http://localhost/api/institutions/applications"));
    expect(reply.status).toBe(401);
    expect(await reply.json()).toEqual({ error: "authentication_required" });
  });
});
