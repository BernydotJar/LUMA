import { afterEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { parseCompletedEnvelopeEvent, verifyDocusignConnectHmac } from "./docusign";

afterEach(() => { delete process.env.DOCUSIGN_CONNECT_HMAC_SECRET; });
describe("Docusign callback verification", () => {
  it("denies missing configuration, missing signature and payload tampering", () => {
    const body = '{"event":"envelope-completed","data":{"envelopeId":"abcde12345"}}';
    expect(verifyDocusignConnectHmac(body, "made-up")).toBe(false);
    process.env.DOCUSIGN_CONNECT_HMAC_SECRET = "a-complex-hmac-key";
    expect(verifyDocusignConnectHmac(body, null)).toBe(false);
    const signed = createHmac("sha256", "a-complex-hmac-key").update(body).digest("base64");
    expect(verifyDocusignConnectHmac(body, signed)).toBe(true);
    expect(verifyDocusignConnectHmac(body + " ", signed)).toBe(false);
  });
  it("ignores non-completion events and invalid envelope IDs", () => {
    expect(parseCompletedEnvelopeEvent({ event: "envelope-sent", data: { envelopeId: "abcde12345" } })).toBeNull();
    expect(parseCompletedEnvelopeEvent({ event: "envelope-completed", data: { envelopeId: "../bad" } })).toBeNull();
    expect(parseCompletedEnvelopeEvent({ event: "envelope-completed", data: { envelopeId: "abcde12345" } })).toBe("abcde12345");
  });
});
