import { describe, expect, it } from "vitest";
import { ClassroomWebhookBodyTooLarge, readClassroomWebhookBody } from "./live-classroom-webhook-body";

describe("bounded LiveKit webhook intake", () => {
  it("preserves raw UTF-8 bytes for the provider HMAC/sha256 signature check", async () => {
    const json = '{"event":"participant_joined","name":"María"}';
    const request = new Request("https://luma.example.test/api/live/webhooks", {
      method: "POST",
      body: json,
    });
    expect(await readClassroomWebhookBody(request)).toBe(json);
  });

  it("rejects an oversized declared body before attempting to read it", async () => {
    const request = new Request("https://luma.example.test/api/live/webhooks", {
      method: "POST",
      body: "small",
      headers: { "content-length": "99999999" },
    });
    await expect(readClassroomWebhookBody(request))
      .rejects.toBeInstanceOf(ClassroomWebhookBodyTooLarge);
  });

  it("rejects a streamed body that exceeds the limit even with no content-length", async () => {
    const request = new Request("https://luma.example.test/api/live/webhooks", {
      method: "POST",
      body: "x".repeat(260_000),
    });
    await expect(readClassroomWebhookBody(request))
      .rejects.toBeInstanceOf(ClassroomWebhookBodyTooLarge);
  });

  it("rejects malformed UTF-8 rather than altering the signed payload", async () => {
    const request = new Request("https://luma.example.test/api/live/webhooks", {
      method: "POST",
      body: new Uint8Array([0xff, 0xfe]),
    });
    await expect(readClassroomWebhookBody(request)).rejects.toThrow();
  });
});
