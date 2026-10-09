import { createHash } from "node:crypto";
import { AccessToken, TokenVerifier, WebhookReceiver } from "livekit-server-sdk";
import { describe, expect, it } from "vitest";
import { signClassroomJoinToken } from "./live-classroom-token";

const apiKey = "LUMA_TEST_KEY";
const apiSecret = "this-is-a-test-only-secret-keep-it-out-of-production";
const roomName = "luma_" + "a".repeat(64);
const identity = "p_" + "b".repeat(64);

describe("LUMA media token permissions", () => {
  it("issues a 10-minute learner token for only its authorized room, without admin/record/screen grants", async () => {
    const signed = await signClassroomJoinToken({
      apiKey, apiSecret, roomName, identity, displayName: "Participante", role: "learner",
    });
    const claim = await new TokenVerifier(apiKey, apiSecret).verify(signed);
    expect(claim.sub).toBe(identity);
    expect(claim.video?.room).toBe(roomName);
    expect(claim.video?.roomJoin).toBe(true);
    expect(claim.video?.roomCreate).toBe(false);
    expect(claim.video?.roomAdmin).toBe(false);
    expect(claim.video?.roomRecord).toBe(false);
    expect(claim.video?.canPublishSources).toContain("camera");
    expect(claim.video?.canPublishSources).toContain("microphone");
    expect(claim.video?.canPublishSources).not.toContain("screen_share");
    const jwtTime = JSON.parse(Buffer.from(signed.split(".")[1], "base64url").toString("utf8")) as { exp: number; nbf: number };
    expect(jwtTime.exp - jwtTime.nbf).toBe(600);
    await expect(new TokenVerifier("WRONG_KEY", apiSecret).verify(signed)).rejects.toThrow();
  });
  it("permits an assigned instructor to share screen but never administer or record a room", async () => {
    const signed = await signClassroomJoinToken({
      apiKey, apiSecret, roomName, identity, displayName: "Coach", role: "instructor",
    });
    const claim = await new TokenVerifier(apiKey, apiSecret).verify(signed);
    expect(claim.video?.canPublishSources).toContain("screen_share");
    expect(claim.video?.canPublishSources).toContain("screen_share_audio");
    expect(claim.video?.roomRecord).toBe(false);
    expect(claim.video?.roomAdmin).toBe(false);
  });
});

describe("provider signature contract", () => {
  it("verifies exact original JSON bytes; rejects tampered payloads and unsigned requests", async () => {
    const body = JSON.stringify({
      id: "EV_test", event: "participant_joined", created_at: 1792500000,
      room: { name: roomName }, participant: { identity },
    });
    const signer = new AccessToken(apiKey, apiSecret, { ttl: "5m" });
    signer.sha256 = createHash("sha256").update(body).digest("base64");
    const signature = await signer.toJwt();
    const receiver = new WebhookReceiver(apiKey, apiSecret);
    const parsed = await receiver.receive(body, signature);
    expect(parsed.event).toBe("participant_joined");
    expect(parsed.room?.name).toBe(roomName);
    await expect(receiver.receive(body, "")).rejects.toThrow();
    await expect(receiver.receive(body.replace("participant_joined", "participant_left"), signature))
      .rejects.toThrow();
  });
});
